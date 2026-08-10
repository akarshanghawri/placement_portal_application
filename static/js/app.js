const { createApp, ref } = Vue

async function initApp() {
    // Wait for Clerk to load
    await window.Clerk.load()

    createApp({
        delimiters: ['[[', ']]'],

        setup() {
            const page = ref('loading')
            const error = ref('')
            const success = ref('')

            // ─── Admin State ───
            const adminStats = ref({})
            const companies = ref([])
            const students = ref([])
            const drives = ref([])
            const applications = ref([])
            const adminSearchCompany = ref('')
            const adminSearchStudent = ref('')
            const adminLoginForm = ref({ email: '', password: '' })


            // ─── Company State ───
            const companyDashboard = ref({})
            const companyApplications = ref([])
            const selectedDriveId = ref(null)
            const driveForm = ref({
                drive_name: '', job_title: '', job_description: '',
                salary: '', location: '', required_branch: 'Any',
                required_cgpa: 0, required_year: '', application_deadline: ''
            })
            const showDriveForm = ref(false)

            // ─── Student State ───
            const studentDrives = ref([])
            const studentApplications = ref([])
            const studentProfile = ref({})
            const studentSearch = ref('')
            const studentView = ref('drives')
            const editingProfile = ref(false)
            const profileForm = ref({})
            const atsResult = ref(null)
            const atsLoading = ref(false)
            const atsDriveId = ref(null)
            const recommendations = ref(null)

            // ─── Register Form ───
            const registerForm = ref({
                username: '', full_name: '', branch: '',
                cgpa: '', year: '', phone: '',
                company_name: '', hr_contact: '', website: '', description: '',
                registerAs: 'student'
            })

            // ─── Helpers ───
            async function getToken() {
                return await window.Clerk.session.getToken()
            }

            async function api(method, url, body = null) {
                const token = await getToken()
                const opts = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
                if (body) opts.body = JSON.stringify(body)
                const res = await fetch(url, opts)
                const data = await res.json()
                return { ok: res.ok, data, status: res.status }
            }

            // ─── Auth ───
            async function checkAuth() {
                // Check admin token first
                const adminToken = localStorage.getItem('admin_token')
                if (adminToken) {
                    page.value = 'admin'
                    loadAdminData()
                    return
                }

                // Then check Clerk
                const user = window.Clerk.user
                if (!user) {
                    page.value = 'login'
                    return
                }

                const { ok, data } = await api('GET', '/api/auth/me')
                if (!ok) {
                    page.value = 'register'
                    return
                }

                if (data.role === 'company') {
                    page.value = 'company'
                    loadCompanyData()
                } else if (data.role === 'student') {
                    page.value = 'student'
                    loadStudentData()
                }
            }

            function showClerkLogin() {
                window.Clerk.openSignIn({
                    afterSignInUrl: window.location.href,
                    afterSignUpUrl: window.location.href,
                })
            }

            async function logout() {
                const adminToken = localStorage.getItem('admin_token')
                if (adminToken) {
                    localStorage.removeItem('admin_token')
                    page.value = 'login'
                    return
                }
                await window.Clerk.signOut()
                page.value = 'login'
                error.value = ''
                success.value = ''
                selectedDriveId.value = null
                companyApplications.value = []
            }

            async function register() {
                error.value = ''
                const clerkUser = window.Clerk.user
                const email = clerkUser.primaryEmailAddress?.emailAddress

                const endpoint = registerForm.value.registerAs === 'student'
                    ? '/api/auth/register/student'
                    : '/api/auth/register/company'

                const payload = {
                    email,
                    username: registerForm.value.username || clerkUser.username || email.split('@')[0],
                    ...registerForm.value
                }

                const { ok, data } = await api('POST', endpoint, payload)
                if (!ok) {
                    error.value = data.message
                    autoClear()
                    return
                }
                success.value = data.message
                autoClear()
                await checkAuth()
            }

            // ─── Admin ───
            async function loadAdminData() {
                const { data: stats } = await adminApiCall('GET', '/api/admin/stats')
                adminStats.value = stats
                const { data: comp } = await adminApiCall('GET', '/api/admin/companies')
                companies.value = comp
                const { data: studs } = await adminApiCall('GET', '/api/admin/students')
                students.value = studs
                const { data: drv } = await adminApiCall('GET', '/api/admin/drives')
                drives.value = drv
                const { data: apps } = await adminApiCall('GET', '/api/admin/applications')
                applications.value = apps
            }

            async function adminLogin() {
                error.value = ''
                const res = await fetch('/api/auth/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(adminLoginForm.value)
                })
                const data = await res.json()
                if (!res.ok) {
                    error.value = data.message
                    autoClear()
                    return
                }

                localStorage.setItem('admin_token', data.token)
                page.value = 'admin'
                loadAdminData()
            }

            async function adminApiCall(method, url, body = null) {
                const token = localStorage.getItem('admin_token')
                const opts = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
                if (body) opts.body = JSON.stringify(body)
                const res = await fetch(url, opts)
                const data = await res.json()
                return { ok: res.ok, data }
            }

            async function updateCompanyStatus(id, status) {
                const { ok } = await adminApiCall('PUT', `/api/admin/companies/${id}/status`, { status })
                if (ok) loadAdminData()
            }

            async function updateDriveStatus(id, status) {
                const { ok } = await adminApiCall('PUT', `/api/admin/drives/${id}/status`, { status })
                if (ok) loadAdminData()
            }

            async function toggleStudent(id, is_active) {
                const { ok } = await adminApiCall('PUT', `/api/admin/students/${id}/status`, { is_active })
                if (ok) loadAdminData()
            }

            async function searchCompanies() {
                if (!adminSearchCompany.value.trim()) {
                    const { data } = await adminApiCall('GET', '/api/admin/companies')
                    companies.value = data
                    return
                }
                const { data } = await adminApiCall('GET', `/api/admin/companies?search=${adminSearchCompany.value}`)
                companies.value = data
            }

            async function searchStudents() {
                if (!adminSearchStudent.value.trim()) {
                    const { data } = await adminApiCall('GET', '/api/admin/students')
                    students.value = data
                    return
                }
                const { data } = await adminApiCall('GET', `/api/admin/students?search=${adminSearchStudent.value}`)
                students.value = data
            }
            // ─── Company ───
            async function loadCompanyData() {
                selectedDriveId.value = null
                companyApplications.value = []
                const { data } = await api('GET', '/api/company/dashboard')
                companyDashboard.value = data
            }

            async function createDrive() {
                const { ok, data } = await api('POST', '/api/company/drives', driveForm.value)
                if (!ok) { error.value = data.message; autoClear(); return }
                success.value = data.message
                autoClear()
                showDriveForm.value = false
                loadCompanyData()
            }

            async function loadDriveApplications(driveId) {
                selectedDriveId.value = driveId
                const { data } = await api('GET', `/api/company/drives/${driveId}/applications`)
                companyApplications.value = data
            }

            async function updateAppStatus(appId, status) {
                await api('PUT', `/api/company/applications/${appId}/status`, { status })
                loadDriveApplications(selectedDriveId.value)
            }

            async function downloadOfferLetter(appId) {
                const token = await getToken()
                const res = await fetch(`/api/company/applications/${appId}/offer-letter`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (!res.ok) {
                    error.value = 'Could not generate offer letter'
                    autoClear()
                    return
                }
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `offer_letter.pdf`
                a.click()
                URL.revokeObjectURL(url)
            }

            // ─── Student ───
            async function loadRecommendations() {
                const { ok, data } = await api('GET', '/api/student/recommendations')
                if (ok) recommendations.value = data
            }

            async function loadStudentData() {
                const { data: drv } = await api('GET', '/api/student/drives')
                studentDrives.value = drv
                const { data: apps } = await api('GET', '/api/student/applications')
                studentApplications.value = apps
                const { data: prof } = await api('GET', '/api/student/profile')
                studentProfile.value = prof
                profileForm.value = { ...prof }
                await loadRecommendations()
            }

            async function applyDrive(driveId) {
                const { ok, data } = await api('POST', `/api/student/drives/${driveId}/apply`)
                if (!ok) { error.value = data.message; autoClear(); return }
                success.value = data.message
                autoClear()
                loadStudentData()
            }

            async function searchDrives() {
                if (!studentSearch.value.trim()) {
                    const { data } = await api('GET', '/api/student/drives')
                    studentDrives.value = data
                    return
                }
                const { data } = await api('GET', `/api/student/drives?search=${studentSearch.value}`)
                studentDrives.value = data
            }

            async function saveProfile() {
                const { ok, data } = await api('PUT', '/api/student/profile', profileForm.value)
                if (!ok) { error.value = data.message; autoClear(); return }
                success.value = data.message
                autoClear()
                editingProfile.value = false
                loadStudentData()
            }

            async function uploadResume(event) {
                const file = event.target.files[0]
                if (!file) return
                const token = await getToken()
                const formData = new FormData()
                formData.append('resume', file)
                const res = await fetch('/api/student/upload-resume', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                })
                const data = await res.json()
                if (res.ok) {
                    success.value = data.message
                    autoClear()
                    loadStudentData()
                } else {
                    error.value = data.message
                    autoClear()
                }
            }

            async function viewResume(filename) {
                window.open(`/api/student/resume/${filename}`, '_blank')
            }

            async function checkResume(driveId) {
                atsResult.value = null
                atsLoading.value = true
                atsDriveId.value = driveId
                const { ok, data } = await api('GET', `/api/student/check-resume/${driveId}`)
                atsLoading.value = false
                if (!ok) { error.value = data.message; autoClear(); return }
                atsResult.value = data
            }

            async function exportCSV() {
                const { ok, data } = await api('POST', '/api/student/export')
                if (ok) {
                    success.value = data.message
                    autoClear()
                }
            }

            function autoClear() {          //auto dismiss error msg 
                setTimeout(() => {
                    error.value = ''
                    success.value = ''
                }, 4000)
            }

            // ─── Init ───
            window.Clerk.addListener(({ user }) => {
                if (user) {
                    checkAuth()
                } else {
                    page.value = 'login'
                }
            })

            checkAuth()

            return {
                page, error, success,
                adminStats, companies, students, drives, applications,
                adminSearchCompany, adminSearchStudent,
                companyDashboard, companyApplications, selectedDriveId,
                driveForm, showDriveForm,
                studentDrives, studentApplications, studentProfile,
                studentSearch, studentView, editingProfile, profileForm,
                registerForm, adminLoginForm, atsResult, atsLoading, atsDriveId, recommendations, loadRecommendations,
                showClerkLogin, logout, register,
                updateCompanyStatus, updateDriveStatus, toggleStudent,
                searchCompanies, searchStudents,
                createDrive, loadDriveApplications, updateAppStatus,
                applyDrive, searchDrives, saveProfile,
                uploadResume, viewResume, exportCSV, adminLogin, autoClear, checkResume,downloadOfferLetter
            }
        },

        template: `
        <div>

        <!-- LOADING -->
        <div v-if="page === 'loading'" class="container mt-5 text-center">
            <div class="spinner-border text-primary"></div>
            <p class="mt-3">Loading...</p>
        </div>

        <!-- LOGIN -->
        <div v-else-if="page === 'login'" 
             class="d-flex align-items-center justify-content-center" 
             style="min-height:100vh; background:#f8f9fa;">
            <div style="width:100%; max-width:420px; padding:20px">
                <h3 class="text-center mb-2 fw-bold">Placement Portal</h3>
                <p class="text-center text-muted mb-4">Campus recruitment made simple</p>
                <div class="card shadow-sm p-5 text-center">
                    <p class="text-muted mb-4">Sign in to continue</p>
                    <button @click="showClerkLogin" class="btn btn-primary w-100 mb-2">
                        Login / Register
                    </button>
                </div>
                <p class="text-center mt-3 mb-0">
                    <a href="#" @click="page='adminlogin'" class="text-muted" style="font-size:0.8rem">
                        Admin Login
                    </a>
                </p>
            </div>
        </div>
        <div v-else-if="page === 'adminlogin'" class="container mt-5" style="max-width:420px">
        <h3 class="text-center mb-4">Admin Login</h3>
            <div class="card p-4 shadow-sm">
                <div v-if="error" class="alert alert-danger">[[ error ]]</div>
                <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input v-model="adminLoginForm.email" type="email" class="form-control">
                </div>
                <div class="mb-3">
                    <label class="form-label">Password</label>
                    <input v-model="adminLoginForm.password" type="password" class="form-control">
                </div>
                <button @click="adminLogin" class="btn btn-danger w-100">Login as Admin</button>
                <p class="text-center mt-3 mb-0">
                    <a href="#" @click="page='login'" class="text-muted">Back</a>
                </p>
            </div>
        </div>

        <!-- REGISTER  -->
        <div v-else-if="page === 'register'" class="container mt-5" style="max-width:500px">
            <h3 class="text-center mb-4">Complete Your Profile</h3>
            <div class="card p-4 shadow-sm">
                <div v-if="error" class="alert alert-danger">[[ error ]]</div>
                <div v-if="success" class="alert alert-success">[[ success ]]</div>
                <div class="mb-3">
                    <label class="form-label">Register As</label>
                    <select v-model="registerForm.registerAs" class="form-select">
                        <option value="student">Student</option>
                        <option value="company">Company</option>
                    </select>
                </div>
                <input v-model="registerForm.username" placeholder="Username" class="form-control mb-2">

                <template v-if="registerForm.registerAs === 'student'">
                    <input v-model="registerForm.full_name" placeholder="Full Name" class="form-control mb-2">
                    <select v-model="registerForm.branch" class="form-select mb-2">
                        <option value="">Select Branch</option>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="ME">ME</option>
                        <option value="CE">CE</option>
                        <option value="EE">EE</option>
                        <option value="IT">IT</option>
                        <option value="Other">Other</option>
                    </select>
                    <div class="mb-2">
                        <label class="form-label d-flex justify-content-between mb-1 small text-muted">
                            <span>CGPA:</span>
                            <strong class="text-primary">[[ registerForm.cgpa || '0.0' ]]</strong>
                        </label>
                        <input v-model="registerForm.cgpa" type="range" min="0.0" max="10.0" step="0.1" class="form-range">
                    </div>
                    <select v-model="registerForm.year" class="form-select mb-2">
                        <option value="">Select Year</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                    </select>
                    <input v-model="registerForm.phone" placeholder="Phone" class="form-control mb-3">
                </template>
                <template v-else>
                    <input v-model="registerForm.company_name" placeholder="Company Name" class="form-control mb-2">
                    <input v-model="registerForm.hr_contact" placeholder="HR Contact" class="form-control mb-2">
                    <input v-model="registerForm.website" placeholder="Website" class="form-control mb-2">
                    <textarea v-model="registerForm.description" placeholder="Description" class="form-control mb-3"></textarea>
                </template>

                <button @click="register" class="btn btn-success w-100">Complete Registration</button>
                <p class="text-center mt-3 mb-0">
                    Wrong account? 
                    <a href="#" @click="logout">Sign out</a>
                </p>
            </div>
        </div>

        <!-- ADMIN DASHBOARD -->
        <div v-else-if="page === 'admin'" class="container-fluid p-4">
            <nav class="navbar navbar-dark bg-primary px-4 mb-4">
                <span class="navbar-brand fw-bold">Admin Dashboard</span>
                <button @click="logout" class="btn btn-outline-light btn-sm">Logout</button>
            </nav>

            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card text-center p-3 bg-primary text-white">
                        <h2>[[ adminStats.total_students ]]</h2><p class="mb-0">Students</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center p-3 bg-success text-white">
                        <h2>[[ adminStats.total_companies ]]</h2><p class="mb-0">Companies</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center p-3 bg-info text-white">
                        <h2>[[ adminStats.total_drives ]]</h2><p class="mb-0">Drives</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center p-3 bg-warning text-white">
                        <h2>[[ adminStats.pending_companies ]]</h2><p class="mb-0">Pending</p>
                    </div>
                </div>
            </div>

            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="input-group">
                        <input v-model="adminSearchCompany" class="form-control" placeholder="Search companies...">
                        <button @click="searchCompanies" class="btn btn-outline-primary">Search</button>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="input-group">
                        <input v-model="adminSearchStudent" class="form-control" placeholder="Search students...">
                        <button @click="searchStudents" class="btn btn-outline-primary">Search</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header"><strong>Registered Companies</strong></div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>Name</th><th>HR Contact</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="c in companies" :key="c.id">
                                <td>[[ c.name ]]</td>
                                <td>[[ c.hr_contact ]]</td>
                                <td>
                                    <span :class="{
                                        'badge bg-warning text-dark': c.approval_status === 'pending',
                                        'badge bg-success': c.approval_status === 'approved',
                                        'badge bg-danger': c.approval_status === 'rejected' || c.approval_status === 'blacklisted'
                                    }">[[ c.approval_status ]]</span>
                                </td>

                                <td>
                                    <button v-if="c.approval_status === 'pending'" @click="updateCompanyStatus(c.id, 'approved')" class="btn btn-success btn-sm me-1">Approve</button>
                                    <button v-if="c.approval_status === 'pending'" @click="updateCompanyStatus(c.id, 'rejected')" class="btn btn-danger btn-sm me-1">Reject</button>
                                    <button v-if="c.approval_status !== 'blacklisted'" @click="updateCompanyStatus(c.id, 'blacklisted')" class="btn btn-dark btn-sm">Blacklist</button>
                                </td>
                            </tr>
                            <tr v-if="companies.length === 0"><td colspan="4" class="text-center text-muted">No companies yet</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header"><strong>Placement Drives</strong></div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>Drive</th><th>Company</th><th>Job Title</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="d in drives" :key="d.id">
                                <td>[[ d.drive_name ]]</td>
                                <td>[[ d.company ]]</td>
                                <td>[[ d.job_title ]]</td>
                                <td>[[ d.deadline || 'N/A' ]]</td>
                                <td>
                                    <span :class="{
                                        'badge bg-warning text-dark': d.status === 'pending',
                                        'badge bg-success': d.status === 'approved',
                                        'badge bg-danger': d.status === 'rejected',
                                        'badge bg-secondary': d.status === 'closed'
                                    }">[[ d.status ]]</span>
                                </td>
                                <td>
                                    <button v-if="d.status === 'pending'" @click="updateDriveStatus(d.id, 'approved')" class="btn btn-success btn-sm me-1">Approve</button>
                                    <button v-if="d.status === 'pending'" @click="updateDriveStatus(d.id, 'rejected')" class="btn btn-danger btn-sm me-1">Reject</button>
                                    <button v-if="d.status === 'approved'" @click="updateDriveStatus(d.id, 'closed')" class="btn btn-secondary btn-sm">Close</button>
                                </td>
                            </tr>
                            <tr v-if="drives.length === 0"><td colspan="6" class="text-center text-muted">No drives yet</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header"><strong>Registered Students</strong></div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>Name</th><th>Branch</th><th>CGPA</th><th>Year</th><th>Email</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="s in students" :key="s.id">
                                <td>[[ s.full_name ]]</td>
                                <td>[[ s.branch ]]</td>
                                <td>[[ s.cgpa ]]</td>
                                <td>[[ s.year ]]</td>
                                <td>[[ s.email ]]</td>
                                <td>
                                    <button v-if="s.is_active" @click="toggleStudent(s.id, false)" class="btn btn-danger btn-sm">Deactivate</button>
                                    <button v-else @click="toggleStudent(s.id, true)" class="btn btn-success btn-sm">Activate</button>
                                </td>
                            </tr>
                            <tr v-if="students.length === 0"><td colspan="6" class="text-center text-muted">No students yet</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header"><strong>All Applications</strong></div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>Student</th><th>Drive</th><th>Company</th><th>Status</th><th>Applied</th></tr></thead>
                        <tbody>
                            <tr v-for="a in applications" :key="a.id">
                                <td>[[ a.student ]]</td>
                                <td>[[ a.drive ]]</td>
                                <td>[[ a.company ]]</td>
                                <td><span class="badge bg-secondary">[[ a.status ]]</span></td>
                                <td>[[ a.applied_at ]]</td>
                            </tr>
                            <tr v-if="applications.length === 0"><td colspan="5" class="text-center text-muted">No applications yet</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- COMPANY DASHBOARD -->
        <div v-else-if="page === 'company'" class="container-fluid p-4">
            <nav class="navbar navbar-dark bg-success px-4 mb-4">
                <span class="navbar-brand fw-bold">Company Dashboard</span>
                <button @click="logout" class="btn btn-outline-light btn-sm">Logout</button>
            </nav>

            <div class="card mb-4 p-3" v-if="companyDashboard.company">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h5>[[ companyDashboard.company.name ]]</h5>
                        <p class="mb-0 text-muted">[[ companyDashboard.company.hr_contact ]] | [[ companyDashboard.company.website ]]</p>
                        <p class="mb-0">[[ companyDashboard.company.description ]]</p>
                    </div>
                    <span :class="{
                        'badge bg-warning fs-6': companyDashboard.company.approval_status === 'pending',
                        'badge bg-success fs-6': companyDashboard.company.approval_status === 'approved',
                        'badge bg-danger fs-6': companyDashboard.company.approval_status === 'rejected'
                    }">[[ companyDashboard.company.approval_status ]]</span>
                </div>
            </div>

            <div v-if="companyDashboard.company && companyDashboard.company.approval_status !== 'approved'" class="alert alert-warning">
                Your company is pending admin approval. You cannot create drives yet.
            </div>

            <div class="mb-3" v-if="companyDashboard.company && companyDashboard.company.approval_status === 'approved'">
                <button @click="showDriveForm = !showDriveForm" class="btn btn-primary">
                    [[ showDriveForm ? 'Cancel' : '+ Create Drive' ]]
                </button>
            </div>

            <div class="card p-4 mb-4" v-if="showDriveForm">
                <h5>New Placement Drive</h5>
                <div v-if="error" class="alert alert-danger">[[ error ]]</div>
                <div class="row">
                    <div class="col-md-6 mb-2"><input v-model="driveForm.drive_name" placeholder="Drive Name" class="form-control"></div>
                    <div class="col-md-6 mb-2"><input v-model="driveForm.job_title" placeholder="Job Title" class="form-control"></div>
                    <div class="col-12 mb-2"><textarea v-model="driveForm.job_description" placeholder="Job Description" class="form-control"></textarea></div>
                    <div class="col-md-4 mb-2"><input v-model="driveForm.salary" placeholder="Salary" class="form-control"></div>
                    <div class="col-md-4 mb-2"><input v-model="driveForm.location" placeholder="Location" class="form-control"></div>
                    <div class="col-md-4 mb-2">
                        <label class="form-label small text-muted mb-1">Application Deadline</label>
                        <input v-model="driveForm.application_deadline" type="date" class="form-control shadow-sm border-primary-subtle">
                    </div>
                    <div class="col-md-4 mb-2">
                        <label class="form-label small text-muted mb-1">Required Branch</label>
                        <select v-model="driveForm.required_branch" class="form-select">
                            <option value="Any">Any Branch</option>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="ME">ME</option>
                            <option value="CE">CE</option>
                            <option value="EE">EE</option>
                            <option value="IT">IT</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="col-md-4 mb-2">
                        <label class="form-label small text-muted mb-1">Min CGPA</label>
                        <div class="d-flex align-items-center gap-2">
                            <input type="range" v-model="driveForm.required_cgpa" 
                                   min="0" max="10" step="0.1" class="form-range flex-grow-1">
                            <span class="badge bg-primary">[[ driveForm.required_cgpa ]]</span>
                        </div>
                    </div>
                    <div class="col-md-4 mb-2"><select v-model="driveForm.required_year" class="form-select">
                    <option value="">Any Year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select></div>
                </div>
                <button @click="createDrive" class="btn btn-success mt-2">Submit Drive</button>
            </div>

            <div class="card mb-4">
                <div class="card-header"><strong>Your Drives</strong></div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>Drive</th><th>Job Title</th><th>Applicants</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="d in companyDashboard.drives" :key="d.id">
                                <td>[[ d.drive_name ]]</td>
                                <td>[[ d.job_title ]]</td>
                                <td>[[ d.applicant_count ]]</td>
                                <td>[[ d.deadline || 'N/A' ]]</td>
                                <td>
                                    <span :class="{
                                        'badge bg-warning text-dark': d.status === 'pending',
                                        'badge bg-success': d.status === 'approved',
                                        'badge bg-danger': d.status === 'rejected',
                                        'badge bg-secondary': d.status === 'closed'
                                    }">[[ d.status ]]</span>
                                </td>
                                <td><button @click="loadDriveApplications(d.id)" class="btn btn-info btn-sm text-white">View Applications</button></td>
                            </tr>
                            <tr v-if="!companyDashboard.drives || companyDashboard.drives.length === 0">
                                <td colspan="6" class="text-center text-muted">No drives yet</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card mb-4" v-if="selectedDriveId">
                <div class="card-header"><strong>Applications for Drive #[[ selectedDriveId ]]</strong></div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead><tr><th>Student</th><th>Branch</th><th>CGPA</th><th>Resume</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            <tr v-for="a in companyApplications" :key="a.id">
                                <td>[[ a.student_name ]]</td>
                                <td>[[ a.branch ]]</td>
                                <td>[[ a.cgpa ]]</td>
                                <td>
                                    <button v-if="a.resume_path" @click="viewResume(a.resume_path)" class="btn btn-sm btn-outline-secondary">Resume</button>
                                    <span v-else class="text-muted">-</span>
                                </td>
                                <td><span class="badge bg-secondary">[[ a.status ]]</span></td>
                                <td>
                                    <select @change="updateAppStatus(a.id, $event.target.value)" class="form-select form-select-sm" style="width:140px">
                                        <option value="applied" :selected="a.status === 'applied'">Applied</option>
                                        <option value="shortlisted" :selected="a.status === 'shortlisted'">Shortlisted</option>
                                        <option value="waiting" :selected="a.status === 'waiting'">Waiting</option>
                                        <option value="selected" :selected="a.status === 'selected'">Selected</option>
                                        <option value="rejected" :selected="a.status === 'rejected'">Rejected</option>
                                    </select>
                                    <button v-if="a.status === 'selected'"
                                        @click="downloadOfferLetter(a.id)"
                                        class="btn btn-success btn-sm mt-1 w-100">
                                        Download Offer Letter
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="companyApplications.length === 0">
                                <td colspan="6" class="text-center text-muted">No applications yet</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- STUDENT DASHBOARD -->
        <div v-else-if="page === 'student'" class="container-fluid p-4">
            <nav class="navbar navbar-dark bg-info px-4 mb-4">
                <span class="navbar-brand fw-bold">Welcome, [[ studentProfile.full_name ]]</span>
                <div>
                    <button @click="studentView='drives'" class="btn btn-outline-light btn-sm me-1">Drives</button>
                    <button @click="studentView='applications'" class="btn btn-outline-light btn-sm me-1">Applications</button>
                    <button @click="studentView='profile'" class="btn btn-outline-light btn-sm me-1">Profile</button>
                    <button @click="logout" class="btn btn-light btn-sm">Logout</button>
                </div>
            </nav>

            <div v-if="error" class="alert alert-danger">[[ error ]]</div>
            <div v-if="success" class="alert alert-success">[[ success ]]</div>

            <div v-if="studentView === 'drives'">

                <!-- AI Recommendations -->
                <div v-if="recommendations && recommendations.recommendations.length > 0" 
                    class="card mb-4 border-warning">
                    <div class="card-header bg-warning text-dark">
                        <strong> AI Recommended for You</strong>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-3">[[ recommendations.advice ]]</p>
                        <div class="row">
                            <div class="col-md-4 mb-2" 
                                v-for="rec in recommendations.recommendations" 
                                :key="rec.drive_id">
                                <div class="card border-warning h-100">
                                    <div class="card-body">
                                    <p class="mb-1">
                                            <strong>
                                                [[ studentDrives.find(d => d.id === rec.drive_id)?.drive_name || 'Loading...' ]]
                                            </strong>
                                            <span class="text-muted small ms-1">
                                                — [[ studentDrives.find(d => d.id === rec.drive_id)?.company ]]
                                            </span>
                                        </p>
                                        <p class="text-muted small mb-0">[[ rec.reason ]]</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="input-group mb-3" style="max-width:400px">
                    <input v-model="studentSearch" class="form-control" placeholder="Search drives...">
                    <button @click="searchDrives" class="btn btn-outline-primary">Search</button>
                </div>
                <div class="row">
                    <div class="col-md-4 mb-3" v-for="d in studentDrives" :key="d.id">
                        <div class="card h-100 shadow-sm border-0">
                            <div class="card-body">
                                <h5 class="card-title">[[ d.drive_name ]]</h5>
                                <h6 class="text-muted">[[ d.company ]]</h6>
                                <p class="mb-1"><strong>Role:</strong> [[ d.job_title ]]</p>
                                <p class="mb-1"><strong>Salary:</strong> [[ d.salary || 'N/A' ]]</p>
                                <p class="mb-1"><strong>Location:</strong> [[ d.location || 'N/A' ]]</p>
                                <p class="mb-1"><strong>Min CGPA:</strong> [[ d.required_cgpa ]]</p>
                                <p class="mb-1"><strong>Branch:</strong> [[ d.required_branch ]]</p>
                                <p class="mb-2"><strong>Deadline:</strong> [[ d.deadline || 'N/A' ]]</p>
                            </div>
                            <div class="card-footer">
                                <button v-if="d.is_placed" class="btn btn-warning btn-sm w-100" disabled>Already Placed</button>
                                <button v-else-if="d.already_applied" class="btn btn-secondary btn-sm w-100" disabled>Already Applied</button>
                                <button v-else @click="applyDrive(d.id)" class="btn btn-primary btn-sm w-100">Apply</button>
                                <button v-if="studentProfile.resume_path" 
                                        @click="checkResume(d.id)" 
                                        class="btn btn-outline-info btn-sm w-100">
                                    Check Resume Match
                                </button>
                            </div>
                        </div>
                    </div>
                    <div v-if="studentDrives.length === 0" class="col-12 text-center text-muted">No approved drives available</div>
                </div>

                <!-- ATS Result -->
                <div v-if="atsLoading" class="text-center mt-3">
                    <div class="spinner-border text-info"></div>
                    <p class="mt-2">Analyzing your resume...</p>
                </div>

                <div v-if="atsResult" class="card mt-4 border-info">
                    <div class="card-header bg-info text-white d-flex justify-content-between">
                        <strong>Resume Match Analysis</strong>
                        <button @click="atsResult=null" class="btn btn-sm btn-light">✕</button>
                    </div>
                    <div class="card-body">
                        <!-- Score -->
                        <div class="text-center mb-4">
                            <h1 :class="{
                                'text-success': atsResult.match_score >= 70,
                                'text-warning': atsResult.match_score >= 40 && atsResult.match_score < 70,
                                'text-danger': atsResult.match_score < 40
                            }">
                                [[ atsResult.match_score ]]%
                            </h1>
                            <p class="text-muted">Match Score</p>
                            <p>[[ atsResult.summary ]]</p>
                        </div>

                        <div class="row">
                            <!-- Strengths -->
                            <div class="col-md-4">
                                <h6 class="text-success">✓ Strengths</h6>
                                <ul class="list-unstyled">
                                    <li v-for="s in atsResult.strengths" :key="s" class="mb-1">
                                        <span class="text-success">•</span> [[ s ]]
                                    </li>
                                </ul>
                            </div>

                            <!-- Gaps -->
                            <div class="col-md-4">
                                <h6 class="text-danger">✗ Gaps</h6>
                                <ul class="list-unstyled">
                                    <li v-for="g in atsResult.gaps" :key="g" class="mb-1">
                                        <span class="text-danger">•</span> [[ g ]]
                                    </li>
                                </ul>
                            </div>

                            <!-- Suggestions -->
                            <div class="col-md-4">
                                <h6 class="text-primary">→ Suggestions</h6>
                                <ul class="list-unstyled">
                                    <li v-for="s in atsResult.suggestions" :key="s" class="mb-1">
                                        <span class="text-primary">•</span> [[ s ]]
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="studentView === 'applications'">
                <h5 class="mb-3">My Application History</h5>
                <button @click="exportCSV" class="btn btn-outline-success btn-sm mb-3">Export as CSV</button>
                <table class="table table-hover">
                    <thead><tr><th>Drive</th><th>Company</th><th>Job Title</th><th>Applied</th><th>Status</th><th>Remarks</th></tr></thead>
                    <tbody>
                        <tr v-for="a in studentApplications" :key="a.id">
                            <td>[[ a.drive_name ]]</td>
                            <td>[[ a.company ]]</td>
                            <td>[[ a.job_title ]]</td>
                            <td>[[ a.applied_at ]]</td>
                            <td>
                                <span :class="{
                                    'badge bg-primary': a.status === 'applied',
                                    'badge bg-warning': a.status === 'shortlisted' || a.status === 'waiting',
                                    'badge bg-success': a.status === 'selected',
                                    'badge bg-danger': a.status === 'rejected'
                                }">[[ a.status ]]</span>
                            </td>
                            <td>[[ a.remarks || '-' ]]</td>
                        </tr>
                        <tr v-if="studentApplications.length === 0">
                            <td colspan="6" class="text-center text-muted">No applications yet</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="studentView === 'profile'" style="max-width:500px">
                <h5 class="mb-3">My Profile</h5>
                <div v-if="!editingProfile">
                    <p><strong>Name:</strong> [[ studentProfile.full_name ]]</p>
                    <p><strong>Email:</strong> [[ studentProfile.email ]]</p>
                    <p><strong>Branch:</strong> [[ studentProfile.branch ]]</p>
                    <p><strong>CGPA:</strong> [[ studentProfile.cgpa ]]</p>
                    <p><strong>Year:</strong> [[ studentProfile.year ]]</p>
                    <p><strong>Phone:</strong> [[ studentProfile.phone ]]</p>
                    <p>
                        <strong>Resume:</strong>
                        <button v-if="studentProfile.resume_path" @click="viewResume(studentProfile.resume_path)" class="btn btn-sm btn-outline-info ms-2">View Resume</button>
                        <span v-else class="text-muted ms-2">No resume uploaded</span>
                    </p>
                    <div class="mb-3">
                        <label class="form-label"><strong>Upload Resume</strong></label>
                        <input type="file" @change="uploadResume" accept=".pdf,.doc,.docx" class="form-control">
                    </div>
                    <button @click="editingProfile=true" class="btn btn-primary">Edit Profile</button>
                </div>
                <div v-else>
                    <input v-model="profileForm.full_name" placeholder="Full Name" class="form-control mb-2">
                    <div class="mb-2">
                        <label class="form-label small text-muted mb-1">Branch</label>
                        <select v-model="profileForm.branch" class="form-select">
                            <option value="">Select Branch</option>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="ME">ME</option>
                            <option value="CE">CE</option>
                            <option value="EE">EE</option>
                            <option value="IT">IT</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="mb-2">
                        <label class="form-label d-flex justify-content-between mb-1 small text-muted">
                            <span>CGPA:</span>
                            <strong class="text-primary">[[ profileForm.cgpa || '0.0' ]]</strong>
                        </label>
                        <input v-model="profileForm.cgpa" type="range" min="0.0" max="10.0" step="0.1" class="form-range">
                    </div>
                    <input v-model="profileForm.year" placeholder="Year" type="number" class="form-control mb-2">
                    <input v-model="profileForm.phone" placeholder="Phone" class="form-control mb-3">
                    <button @click="saveProfile" class="btn btn-success me-2">Save</button>
                    <button @click="editingProfile=false" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>

        </div>
        `
    }).mount('#app')
}

// Wait for Clerk to be ready then init
window.addEventListener('load', () => {
    const interval = setInterval(() => {
        if (window.Clerk) {
            clearInterval(interval)
            initApp()
        }
    }, 100)
})