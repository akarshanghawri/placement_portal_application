import jwt
import requests
from functools import wraps
from flask import request, jsonify, g
from .models import User, Student, Company
from . import db

JWKS_CACHE = None

def get_jwks(clerk_frontend_api):
    global JWKS_CACHE
    if JWKS_CACHE:
        return JWKS_CACHE
    url = f"{clerk_frontend_api}/.well-known/jwks.json"
    res = requests.get(url)
    JWKS_CACHE = res.json()
    return JWKS_CACHE

def verify_clerk_token(token, clerk_frontend_api):
    jwks = get_jwks(clerk_frontend_api)
    public_keys = {}
    for key_data in jwks['keys']:
        kid = key_data['kid']
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
        public_keys[kid] = public_key

    header = jwt.get_unverified_header(token)
    kid = header['kid']
    public_key = public_keys.get(kid)

    if not public_key:
        return None

    payload = jwt.decode(
        token,
        public_key,
        algorithms=['RS256'],
        options={'verify_aud': False}
    )
    return payload

def clerk_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        from flask import current_app
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'message': 'Missing token'}), 401

        token = auth_header.split(' ')[1]
        try:
            payload = verify_clerk_token(
                token,
                current_app.config['CLERK_FRONTEND_API']
            )
        except Exception as e:
            return jsonify({'message': f'Invalid token: {str(e)}'}), 401

        clerk_user_id = payload.get('sub')
        user = User.query.filter_by(clerk_id=clerk_user_id).first()

        # Don't block unregistered users — routes handle None themselves
        g.user = user
        g.clerk_id = clerk_user_id

        # Only check is_active if user exists
        if user and not user.is_active:
            return jsonify({'message': 'Account is deactivated'}), 403

        return f(*args, **kwargs)

    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'user') or g.user.role != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

def company_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'user') or g.user.role != 'company':
            return jsonify({'message': 'Company access required'}), 403
        company = Company.query.filter_by(user_id=g.user.id).first()
        if not company:
            return jsonify({'message': 'Company profile not found'}), 404
        g.company = company
        return f(*args, **kwargs)
    return decorated

def student_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'user') or g.user.role != 'student':
            return jsonify({'message': 'Student access required'}), 403
        student = Student.query.filter_by(user_id=g.user.id).first()
        if not student:
            return jsonify({'message': 'Student profile not found'}), 404
        g.student = student
        return f(*args, **kwargs)
    return decorated