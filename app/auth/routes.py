from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from .. import db
from ..models import User, Student, Company
import json

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    if request.method == 'POST' :
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password, password):
            return jsonify({'message': 'Invalid credentials'}), 401

        if not user.is_active:
            return jsonify({'message': 'Account is deactivated'}), 403

        token = create_access_token(identity=json.dumps({
            'id': user.id,
            'role': user.role,
            'username': user.username
        }))

        return jsonify({
            'token': token,
            'role': user.role,
            'username': user.username
        }), 200


@auth_bp.route('/register/student', methods=['POST'])
def register_student():
    data = request.get_json()

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already registered'}), 400

    user = User(
        username=data['username'],
        email=data['email'],
        password=generate_password_hash(data['password']),
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

    return jsonify({'message': 'Student registered successfully'}), 201


@auth_bp.route('/register/company', methods=['POST'])
def register_company():
    data = request.get_json()

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already registered'}), 400

    user = User(
        username=data['username'],
        email=data['email'],
        password=generate_password_hash(data['password']),
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