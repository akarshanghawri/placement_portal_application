from flask import Blueprint, request, jsonify, g
from .. import db
from ..models import User, Student, Company
from ..clerk_auth import clerk_required,verify_clerk_token
import os
from flask import current_app
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token
import json

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/setup-admin', methods=['POST'])
def setup_admin():
    # if no admin exists yet
    existing_admin = User.query.filter_by(role='admin').first()
    if existing_admin:
        return jsonify({'message': 'Admin already exists'}), 400

    secret = request.get_json().get('setup_secret')
    if secret != os.environ.get('ADMIN_SETUP_SECRET'):
        return jsonify({'message': 'Invalid setup secret'}), 403

    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1]
    
    payload = verify_clerk_token(token, current_app.config['CLERK_FRONTEND_API'])
    clerk_id = payload.get('sub')

    data = request.get_json()
    admin = User(
        clerk_id=clerk_id,
        email=data['email'],
        username='admin',
        role='admin'
    )
    db.session.add(admin)
    db.session.commit()
    return jsonify({'message': 'Admin created'}), 201

@auth_bp.route('/admin/login', methods=['POST'])
def admin_login():
    from sqlalchemy import text
    from .. import db

    # forces fresh connection 
    try:
        db.session.execute(text('SELECT 1'))
    except:
        db.session.rollback()
        db.session.remove()
    
    data = request.get_json()
    user = User.query.filter_by(email=data['email'], role='admin').first()

    if not user or not check_password_hash(user.password, data['password']):
        return jsonify({'message': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'message': 'Account deactivated'}), 403

    token = create_access_token(identity=json.dumps({
        'id': user.id,
        'role': user.role,
        'username': user.username
    }))

    return jsonify({'token': token, 'role': 'admin'}), 200

@auth_bp.route('/register/student', methods=['POST'])
@clerk_required
def register_student():
    existing = User.query.filter_by(clerk_id=g.clerk_id).first()
    if existing:
        return jsonify({'message': 'Already registered', 'role': existing.role}), 400

    data = request.get_json()
    user = User(
        clerk_id=g.clerk_id,
        email=data['email'],
        username=data.get('username', ''),
        role='student'
    )
    db.session.add(user)
    db.session.flush()  # get user.id before commit

    profile = Student(
        user_id=user.id,
        full_name=data.get('full_name'),
        branch=data.get('branch'),
        cgpa=data.get('cgpa'),
        year=data.get('year'),
        phone=data.get('phone')
    )
    db.session.add(profile)
    db.session.commit()

    return jsonify({'message': 'Student registered', 'role': 'student'}), 201


@auth_bp.route('/register/company', methods=['POST'])
@clerk_required
def register_company():
    existing = User.query.filter_by(clerk_id=g.clerk_id).first()
    if existing:
        return jsonify({'message': 'Already registered', 'role': existing.role}), 400

    data = request.get_json()
    user = User(
        clerk_id=g.clerk_id,
        email=data['email'],
        username=data.get('username', ''),
        role='company'
    )
    db.session.add(user)
    db.session.flush()

    profile = Company(
        user_id=user.id,
        name=data['company_name'],
        hr_contact=data.get('hr_contact'),
        website=data.get('website'),
        description=data.get('description')
    )
    db.session.add(profile)
    db.session.commit()

    return jsonify({'message': 'Company registered. Await admin approval.'}), 201


@auth_bp.route('/me', methods=['GET'])
@clerk_required
def me():
    if not g.user:
        return jsonify({'message': 'User not found'}), 404
    
    return jsonify({
        'id': g.user.id,
        'role': g.user.role,
        'email': g.user.email,
        'is_active': g.user.is_active
    })