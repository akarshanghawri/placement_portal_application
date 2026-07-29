from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from .. import db
from ..models import User, Student, Company, PlacementDrive, Application
from .. import cache
import json

admin_bp = Blueprint('admin', __name__)

def admin_required():
    identity = json.loads(get_jwt_identity())
    if identity['role'] != 'admin':
        return jsonify({'message': 'Admin access required'}), 403
    return None

# stats
@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def stats():
    err = admin_required()
    if err: 
        return err

    # cached = cache.get('admin_stats')
    # if cached:
    #     return cached

    response = jsonify({
        'total_students': Student.query.count(),
        'total_companies': Company.query.count(),
        'total_drives': PlacementDrive.query.count(),
        'pending_companies': Company.query.filter_by(approval_status='pending').count(),
        'pending_drives': PlacementDrive.query.filter_by(status='pending').count(),
    })
    # cache.set('admin_stats', response, timeout=300)
    return response

# all companies
@admin_bp.route('/companies', methods=['GET'])
@jwt_required()
def get_companies():
    err = admin_required()
    if err: 
        return err

    search = request.args.get('search', '')

    if not search:
        cached = cache.get('admin_companies')
        if cached:
            return cached

    query = Company.query
    if search:
        query = query.filter(Company.name.ilike(f'%{search}%'))
    companies = query.all()

    result = []
    for c in companies:
        result.append({
            'id': c.id,
            'name': c.name,
            'hr_contact': c.hr_contact,
            'website': c.website,
            'approval_status': c.approval_status,
            'user_id': c.user_id
        })

    response = jsonify(result)
    if not search:
        cache.set('admin_companies', response, timeout=300)
    return response

# Approve/reject/blacklist company
@admin_bp.route('/companies/<int:company_id>/status', methods=['PUT'])
@jwt_required()
def update_company_status(company_id):
    err = admin_required()
    if err: 
        return err

    company = Company.query.get(company_id)
    status = request.get_json().get('status')
    company.approval_status = status

    if status == 'blacklisted':
        user = User.query.get(company.user_id)
        user.is_active = False
        PlacementDrive.query.filter_by(company_id=company.id).update({'status': 'closed'})

    cache.delete('admin_stats')
    cache.delete('admin_companies')
    cache.delete('admin_drives')

    db.session.commit()
    return jsonify({'message': f'Company {status}'})

# all students
@admin_bp.route('/students', methods=['GET'])
@jwt_required()
def get_students():
    err = admin_required()
    if err: 
        return err

    search = request.args.get('search', '')
    query = Student.query
    if search:
        query = query.join(User).filter(
            (Student.full_name.ilike(f'%{search}%')) |
            (User.email.ilike(f'%{search}%'))
        )
    students = query.all()
    return jsonify([{
        'id': s.id,
        'full_name': s.full_name,
        'branch': s.branch,
        'cgpa': s.cgpa,
        'year': s.year,
        'email': s.user.email,
        'is_active': s.user.is_active
    } for s in students])

# Blacklist student
@admin_bp.route('/students/<int:student_id>/status', methods=['PUT'])
@jwt_required()
def update_student_status(student_id):
    err = admin_required()
    if err: 
        return err

    student = Student.query.get(student_id)
    is_active = request.get_json().get('is_active')
    user = User.query.get(student.user_id)
    user.is_active = is_active
    db.session.commit()
    return jsonify({'message': 'Student status updated'})

# all drives
@admin_bp.route('/drives', methods=['GET'])
@jwt_required()
def get_drives():
    err = admin_required()
    if err: 
        return err

    cached = cache.get('admin_drives')
    if cached:
        return cached

    drives = PlacementDrive.query.all()
    response = jsonify([{
        'id': d.id,
        'drive_name': d.drive_name,
        'job_title': d.job_title,
        'company': d.company.name,
        'status': d.status,
        'deadline': d.application_deadline.strftime('%Y-%m-%d') if d.application_deadline else None
    } for d in drives])

    cache.set('admin_drives', response, timeout=300)
    return response

# Approve/reject drive
@admin_bp.route('/drives/<int:drive_id>/status', methods=['PUT'])
@jwt_required()
def update_drive_status(drive_id):
    err = admin_required()
    if err: 
        return err

    drive = PlacementDrive.query.get(drive_id)
    status = request.get_json().get('status')
    drive.status = status
    db.session.commit()

    cache.delete('admin_stats')
    cache.delete('admin_drives')

    return jsonify({'message': f'Drive {status}'})

# all applications
@admin_bp.route('/applications', methods=['GET'])
@jwt_required()
def get_applications():
    err = admin_required()
    if err:
        return err

    apps = Application.query.all()
    result = []
    for a in apps:
        result.append({
            'id': a.id,
            'student': a.student.full_name,
            'drive': a.drive.drive_name,
            'company': a.drive.company.name,
            'status': a.status,
            'applied_at': a.applied_at.strftime('%Y-%m-%d')
        })
    return jsonify(result)