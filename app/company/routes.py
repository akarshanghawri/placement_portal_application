from flask import Blueprint, request, jsonify, g
from datetime import datetime
from .. import db
from ..models import *
from ..clerk_auth import clerk_required, company_required

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.units import inch
from reportlab.lib import colors
from flask import send_file
import io
from datetime import datetime

company_bp = Blueprint('company', __name__)

# Stats
@company_bp.route('/dashboard', methods=['GET'])
@clerk_required
@company_required
def dashboard():
    company = g.company
    
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
@clerk_required
@company_required
def create_drive():
    company = g.company
    
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
@clerk_required
@company_required
def drive_applications(drive_id):
    company = g.company
    
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
@clerk_required
@company_required
def update_application(app_id):
    company = g.company

    application = Application.query.get(app_id)
    status = request.get_json().get('status')
    application.status = status
    db.session.commit()

    return jsonify({'message': f'Application {status}'})

@company_bp.route('/applications/<int:app_id>/offer-letter', methods=['GET'])
@clerk_required
@company_required
def generate_offer_letter(app_id) :
    company = g.company
    application = Application.query.get_or_404(app_id)

    if application.status != 'selected' :
        return jsonify({'message': 'Offer letter is only for selected candidates'}, 400)
    
    if application.drive.company_id != company.id :
        return jsonify({'message': 'Unauthorized'}, 403)
    
    student = application.student 
    drive = application.drive

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch
    )

    styles = getSampleStyleSheet()
    elements = []

    # Company Header
    elements.append(Paragraph(
        company.name.upper(),
        ParagraphStyle('CompanyName', fontSize=20, fontName='Helvetica-Bold',
                      textColor=colors.HexColor('#2E75B6'), spaceAfter=4)
    ))
    if company.website:
        elements.append(Paragraph(
            company.website,
            ParagraphStyle('Website', fontSize=10, textColor=colors.grey, spaceAfter=4)
        ))
    if company.hr_contact:
        elements.append(Paragraph(
            f"HR Contact: {company.hr_contact}",
            ParagraphStyle('HR', fontSize=10, textColor=colors.grey, spaceAfter=12)
        ))

    elements.append(HRFlowable(width="100%", thickness=2,
                               color=colors.HexColor('#2E75B6'), spaceAfter=20))

    # Date
    elements.append(Paragraph(
        f"Date: {datetime.utcnow().strftime('%B %d, %Y')}",
        ParagraphStyle('Date', fontSize=10, spaceAfter=20)
    ))

    # Title
    elements.append(Paragraph(
        "OFFER LETTER",
        ParagraphStyle('Title', fontSize=16, fontName='Helvetica-Bold',
                      alignment=1, spaceAfter=20)
    ))

    # Candidate Details
    elements.append(Paragraph(
        f"Dear {student.full_name},",
        ParagraphStyle('Dear', fontSize=12, spaceAfter=12)
    ))

    elements.append(Paragraph(
        f"We are pleased to offer you the position of <b>{drive.job_title}</b> at <b>{company.name}</b>. "
        f"After careful consideration of your profile and performance during our recruitment process, "
        f"we believe you will be a valuable addition to our team.",
        ParagraphStyle('Body', fontSize=11, leading=18, spaceAfter=16)
    ))

    # Details Table
    details = [
        ("Position", drive.job_title),
        ("Department", student.branch or "To be assigned"),
        ("Location", drive.location or "To be confirmed"),
        ("CTC", drive.salary or "As per company norms"),
        ("Joining Date", "As mutually agreed"),
    ]

    for label, value in details:
        elements.append(Paragraph(
            f"<b>{label}:</b> {value}",
            ParagraphStyle('Detail', fontSize=11, leading=18, spaceAfter=6)
        ))

    elements.append(Spacer(1, 16))

    elements.append(Paragraph(
        "This offer is contingent upon successful completion of background verification and "
        "submission of required documents. Please confirm your acceptance within 7 days.",
        ParagraphStyle('Body', fontSize=11, leading=18, spaceAfter=24)
    ))

    elements.append(Paragraph(
        "We look forward to welcoming you to our team.",
        ParagraphStyle('Body', fontSize=11, leading=18, spaceAfter=32)
    ))

    # Signature
    elements.append(HRFlowable(width="100%", thickness=1,
                               color=colors.grey, spaceAfter=16))
    elements.append(Paragraph(
        f"<b>{company.hr_contact or 'HR Manager'}</b>",
        ParagraphStyle('Sig', fontSize=11, spaceAfter=4)
    ))
    elements.append(Paragraph(
        f"Human Resources, {company.name}",
        ParagraphStyle('SigTitle', fontSize=10, textColor=colors.grey)
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f"Offer_Letter_{student.full_name.replace(' ', '_')}_{company.name.replace(' ', '_')}.pdf"

    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=filename
    )
    
