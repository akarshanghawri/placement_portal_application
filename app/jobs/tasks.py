from .. import celery
from ..models import Student, Application, PlacementDrive, User
from flask_mail import Message
from datetime import datetime, timedelta
import csv
import io
from zoneinfo import ZoneInfo

# Daily Reminder (deadlines)
@celery.task
def send_daily_reminders():
    from flask import current_app
    from app import mail


    tomorrow = datetime.utcnow() + timedelta(days=1)
    
    # drives with deadline tomorrow
    deadlines = PlacementDrive.query.filter(
        PlacementDrive.status == 'approved',
        PlacementDrive.application_deadline <= tomorrow,
        PlacementDrive.application_deadline >= datetime.utcnow()
    ).all()

    if not deadlines :
        return "No deadlines"

    # send reminder to students who havent registered yet 
    students = Student.query.join(User).filter(User.is_active == True).all()

    for student in students :
        applied_drives = [a.drive_id for a in student.applications]
        remind_drives = [d for d in deadlines if d.id not in applied_drives]

        drive_list = ""

        for d in remind_drives :
            drive_list += f"- {d.drive_name} by {d.company.name} (Deadline: {d.application_deadline.strftime('%Y-%m-%d')})\n"

        msg = Message(
            subject="Placement Portal — Upcoming Deadlines",
            sender=current_app.config['MAIL_USERNAME'],
            recipients=[student.user.email],

            body=f"Hi {student.full_name},\nThe deadlines of the drives are near, dont forget to apply :\n{drive_list}\n\nLogin to apply."
        )

        mail.send(msg)

    return f"Reminders sent for {len(deadlines)} drives"


# Monthly Report (to admin on day 1 of the month)
@celery.task
def send_monthly_report():

    from flask import current_app
    from app import mail

    now = datetime.utcnow()
    first_day = now.replace(day=1)

    drives_this_month = PlacementDrive.query.filter(
        PlacementDrive.created_at >= first_day
    ).count()

    applications_this_month = Application.query.filter(
        Application.applied_at >= first_day
    ).all()

    selected = [a for a in applications_this_month if a.status == 'selected']

    html_code = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Monthly Placement Report — {now.strftime('%B %Y')}</h2>
        <hr>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
            <tr style="background:#f0f0f0">
                <th>Metric</th>
                <th>Count</th>
            </tr>
            <tr>
                <td>Drives Conducted</td>
                <td>{drives_this_month}</td>
            </tr>
            <tr>
                <td>Total Applications</td>
                <td>{len(applications_this_month)}</td>
            </tr>
            <tr>
                <td>Students Selected</td> 
                <td>{len(selected)}</td>
            </tr>
        </table>
    </body>
    </html>
    """

    admin = User.query.filter_by(role='admin').first()
    msg = Message(
        subject =f"Monthly Placement Report — {now.strftime('%B %Y')}",
        sender = current_app.config['MAIL_USERNAME'],
        recipients =[admin.email],
        html = html_code
    )
    mail.send(msg)
    return "Monthly report sent"


# CSV export 
@celery.task
def export_applications_csv(student_id):
    from flask import current_app
    from app import mail

    student = Student.query.get(student_id)
    apps = Application.query.filter_by(student_id=student_id).all()

    output = io.StringIO()      # creates an in-memory file not stored in disk
    writer = csv.writer(output)
    writer.writerow(['Application ID', 'Company', 'Drive', 'Job Title', 'Status', 'Applied At'])

    for a in apps:
        writer.writerow([
            a.id,
            a.drive.company.name,
            a.drive.drive_name,
            a.drive.job_title,
            a.status,
            a.applied_at.strftime('%Y-%m-%d')
        ])

    csv_content = output.getvalue()

    msg = Message(
        subject="Placement Application History",
        sender=current_app.config['MAIL_USERNAME'],
        recipients=[student.user.email],
        body=f"Hi {student.full_name},here's your application history.",
    )
    msg.attach(
    filename='applications.csv',
    content_type='text/csv',
    data=csv_content
    )

    mail.send(msg)
    return f"CSV sent to {student.user.email}"


# Testing scheduled jobs 

# from app import create_app
# app = create_app()
# ctx = app.app_context()
# ctx.push()
# from app.jobs.tasks import send_daily_reminders, send_monthly_report
# send_daily_reminders()
# send_monthly_report()