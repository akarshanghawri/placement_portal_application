from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from .. import db
from ..models import *
import json 

company_bp = Blueprint('company', __name__)

def get_company():
    identity = json.loads(get_jwt_identity())
    if identity['role'] != 'company':
        return None, jsonify({'message': 'Company access required'}), 403
    
    company = Company.query.filter_by(user_id=identity['id']).first()
    if not company:
        return None, jsonify({'message': 'Company profile not found'}), 404
    
    return company, None, None

# Stats
@company_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    company, err, code = get_company()
    if err: 
        return err, code
    
    drives = PlacementDrive.query.filter_by(company_id=company.id).all()

    drives_data = []
    for d in drives:
        drives_data.append({
            'id': d.id,
            'drive_name': d.drive_name,
            'job_title': d.job_title,
            'status': d.status,
            'applicant_count': len(d.applications),
            'deadline': d.application_deadline.strftime('%Y-%m-%d')
        })

    return jsonify({
        'company': {
            'id': company.id,
            'name': company.name,
            'approval_status': company.approval_status,
            'hr_contact': company.hr_contact,
            'website': company.website,
            'description': company.description
        },
        'drives': drives_data
    })

# Create drive
@company_bp.route('/drives', methods=['POST'])
@jwt_required()
def create_drive():
    company, err, code = get_company()
    if err:
        return err, code
    
    if company.approval_status != 'approved':
        return jsonify({'message': 'Your company is not approved yet'}), 403
    
    data = request.get_json()
    drive = PlacementDrive(
        company_id=company.id,
        drive_name=data['drive_name'],
        job_title=data['job_title'],
        job_description=data.get('job_description'),
        salary=data.get('salary'),
        location=data.get('location'),
        required_branch=data.get('required_branch', 'Any'),
        required_cgpa=data.get('required_cgpa', 0.0),
        required_year=data.get('required_year'),
        application_deadline=datetime.strptime(data['application_deadline'], '%Y-%m-%d') 
    )

    db.session.add(drive)
    db.session.commit()
    return jsonify({'message': 'Drive created, pending admin approval'}), 201

# Get applications for a drive
@company_bp.route('/drives/<int:drive_id>/applications', methods=['GET'])
@jwt_required()
def drive_applications(drive_id):
    company, err, code = get_company()
    if err: 
        return err, code
    
    drive = PlacementDrive.query.get(drive_id)

    if drive.company_id != company.id:
        return jsonify({'message': 'Unauthorized'}), 403
    
    apps = Application.query.filter_by(drive_id=drive_id).all()
    result = []

    for a in apps:
        item = {
            'id': a.id,
            'student_id': a.student_id,
            'student_name': a.student.full_name,
            'branch': a.student.branch,
            'cgpa': a.student.cgpa,
            'status': a.status,
            'applied_at': a.applied_at.strftime('%Y-%m-%d'),
            'resume_path': a.student.resume_path
        }
        result.append(item)

    return jsonify(result)

# Update application status
@company_bp.route('/applications/<int:app_id>/status', methods=['PUT'])
@jwt_required()
def update_application(app_id):
    company, err, code = get_company()

    if err: 
        return err, code
    
    application = Application.query.get(app_id)
    status = request.get_json().get('status')
    application.status = status
    db.session.commit()



    return jsonify({'message': f'Application {status}'})