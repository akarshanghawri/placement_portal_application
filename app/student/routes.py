from flask import Blueprint, request, jsonify,g, current_app
from .. import db, cache
from ..models import *
from ..jobs.tasks import export_applications_csv
from werkzeug.utils import secure_filename
import os 
from ..clerk_auth import clerk_required, student_required
from datetime import datetime
from supabase import create_client

student_bp = Blueprint('student', __name__)

# Student dashboard
@student_bp.route('/drives', methods=['GET'])
@clerk_required
@student_required
def get_drives():
    student = g.student 
    search = request.args.get('search', '')
    query = PlacementDrive.query.filter_by(status='approved')

    if search:
        query = query.filter((PlacementDrive.drive_name.ilike(f'%{search}%')) )
    drives = query.all()

    applied_ids = []
    applications = Application.query.filter_by(student_id=student.id).all()

    for a in applications:
        applied_ids.append(a.drive_id)

    result = []

    for d in drives:
        item = {
            'id': d.id,
            'drive_name': d.drive_name,
            'job_title': d.job_title,
            'company': d.company.name,
            'location': d.location,
            'salary': d.salary,
            'required_cgpa': d.required_cgpa,
            'required_branch': d.required_branch,
            'required_year': d.required_year,
            'deadline': d.application_deadline.strftime('%Y-%m-%d'),
            'already_applied': d.id in applied_ids
        }
        result.append(item)

    return jsonify(result)

# Apply for drive
@student_bp.route('/drives/<int:drive_id>/apply', methods=['POST'])
@clerk_required
@student_required
def apply(drive_id):
    student = g.student 
    drive = PlacementDrive.query.get(drive_id)


    if drive.required_cgpa and student.cgpa < drive.required_cgpa:
        return jsonify({'message': 'You do not meet the CGPA requirement'}), 403
    if drive.required_year and student.year != drive.required_year:
        return jsonify({'message': 'You do not meet the year requirement'}), 403
    if drive.required_branch and drive.required_branch != 'Any':
        allowed = []
        branches = drive.required_branch.split(',')
        for b in branches:
            allowed.append(b.strip())

        if student.branch not in allowed:
            return jsonify({'message': 'Your branch is not eligible'}), 403
    if drive.application_deadline and datetime.utcnow() > drive.application_deadline:
        return jsonify({'message': 'Application deadline has passed'}), 400

    app = Application(student_id=student.id, drive_id=drive_id)
    db.session.add(app)
    db.session.commit()

    cache.delete('approved_drives')

    return jsonify({'message': 'Applied successfully'}), 201

@student_bp.route('/applications', methods=['GET'])
@clerk_required
@student_required
def my_applications():
    student = g.student 
    
    apps = Application.query.filter_by(student_id=student.id).all()

    result = []
    for a in apps:
        item = {
            'id': a.id,
            'drive_name': a.drive.drive_name,
            'company': a.drive.company.name,
            'job_title': a.drive.job_title,
            'status': a.status,
            'applied_at': a.applied_at.strftime('%Y-%m-%d'),
            'interview_type': a.interview_type,
            'remarks': a.remarks
        }
        result.append(item)

    return jsonify(result)

@student_bp.route('/profile', methods=['PUT'])
@clerk_required
@student_required
def edit_profile():
    student = g.student 
    data = request.get_json()

    student.full_name = data.get('full_name', student.full_name)
    student.branch = data.get('branch', student.branch)
    student.cgpa = data.get('cgpa', student.cgpa)
    student.year = data.get('year', student.year)
    student.phone = data.get('phone', student.phone)

    db.session.commit()
    return jsonify({'message': 'Profile updated'})

# Get profile
@student_bp.route('/profile', methods=['GET'])
@clerk_required
@student_required
def get_profile():
    student = g.student 
    
    return jsonify({
        'full_name': student.full_name,
        'branch': student.branch,
        'cgpa': student.cgpa,
        'year': student.year,
        'phone': student.phone,
        'email': student.user.email,
        'resume_path': student.resume_path
    })

@student_bp.route('/export', methods=['POST'])
@clerk_required
@student_required
def export_csv():
    student = g.student 
    export_applications_csv.delay(student.id)  # .delay() triggers async

    return jsonify({'message': 'You will receive an email shortly.'})

def get_supabase():
    url = current_app.config['SUPABASE_URL']
    key = current_app.config['SUPABASE_SERVICE_KEY']
    return create_client(url, key)

def allowed_file(filename):
    return filename.endswith(('.pdf', '.doc', '.docx')) 

@student_bp.route('/upload-resume', methods=['POST'])
@clerk_required
@student_required
def upload_resume():
    student = g.student

    if 'resume' not in request.files:
        return jsonify({'message': 'No file uploaded'}), 400

    file = request.files['resume']

    if not allowed_file(file.filename):
        return jsonify({'message': 'Only PDF, DOC, DOCX allowed'}), 400

    filename = secure_filename(f"student_{student.id}_{file.filename}")
    file_bytes = file.read()

    supabase = get_supabase()
    
    # Deletes old resume if exists
    if student.resume_path:
        supabase.storage.from_('resumes').remove([student.resume_path])

    # Upload new resume
    supabase.storage.from_('resumes').upload(
        path=filename,
        file=file_bytes,
        file_options={'content-type': file.content_type}
    )

    # Stores filename in DB
    student.resume_path = filename
    db.session.commit()

    return jsonify({'message': 'Resume uploaded', 'filename': filename})

@student_bp.route('/resume/<filename>', methods=['GET'])
def view_resume(filename):
    supabase = get_supabase()
    # Generates public URL
    url = supabase.storage.from_('resumes').get_public_url(filename)
    from flask import redirect
    return redirect(url)