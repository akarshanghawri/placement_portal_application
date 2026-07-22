from . import db
from datetime import datetime

from datetime import datetime
import pytz

def ist_time():
    ist = pytz.timezone('Asia/Kolkata')
    return datetime.now(ist).replace(tzinfo=None)

class User(db.Model):
    __tablename__ = 'user'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    
    # role - admin, company, student 
    role = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=ist_time())

    #  uselist - Shape of data (single object(False) vs list(True))
    student_profile = db.relationship('Student', backref='user', uselist=False)
    company_profile = db.relationship('Company', backref='user', uselist=False)


class Student(db.Model):
    __tablename__ = 'student'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    full_name = db.Column(db.String(100))
    branch = db.Column(db.String(100))
    cgpa = db.Column(db.Float)
    year = db.Column(db.Integer)
    phone = db.Column(db.String(15))  
    resume_path = db.Column(db.Text)

    applications = db.relationship('Application', backref='student', lazy=True)


class Company(db.Model):
    __tablename__ = 'company'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    name = db.Column(db.String(150), nullable=False)
    hr_contact = db.Column(db.String(100))
    website = db.Column(db.String(200))
    description = db.Column(db.Text)
    
    # status - pending,approved, rejected, blacklisted
    approval_status = db.Column(db.String(20), default='pending')

    drives = db.relationship('PlacementDrive', backref='company', lazy=True)


class PlacementDrive(db.Model):
    __tablename__ = 'placement_drive'

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'),nullable=False)

    drive_name = db.Column(db.String(150), nullable=False)
    job_title = db.Column(db.String(100), nullable=False)
    job_description = db.Column(db.Text)
    salary = db.Column(db.String(50))
    location = db.Column(db.String(100))

    created_at = db.Column(db.DateTime, default=ist_time())
    
    # Eligibility
    required_branch = db.Column(db.String(100))   
    required_cgpa = db.Column(db.Float, default=0.0)
    required_year = db.Column(db.Integer)

    application_deadline = db.Column(db.DateTime)
    
    # status - pending, pproved, closed
    status = db.Column(db.String(20), default='pending')

    applications = db.relationship('Application', backref='drive', lazy=True)


class Application(db.Model):
    __tablename__ = 'application'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student.id'),nullable=False)
    drive_id = db.Column(db.Integer,db.ForeignKey('placement_drive.id'), nullable=False)

    applied_at = db.Column(db.DateTime, default=ist_time())
    
    
    status = db.Column(db.String(20), default='applied')

    interview_type = db.Column(db.String(50))   #online or in person
    remarks = db.Column(db.String(200))

    # prevents duplicate applications
    __table_args__ = (
        db.UniqueConstraint('student_id', 'drive_id', name='unique_application'),
    )