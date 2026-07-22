const{ createApp, ref } = Vue

createApp({
    delimiters: ['[[', ']]'],

    setup(){
        const page = ref('login')
        const token = ref(localStorage.getItem('token'))
        const role = ref(localStorage.getItem('role'))
        const error = ref('')
        const success = ref('')

        // Auth Forms
        const loginForm = ref({ email: '', password: '' })
        const registerForm = ref({
            username: '', email: '', password: '',
            full_name: '', branch: '', cgpa: '', year: '', phone: '',
            company_name: '', hr_contact: '', website: '', description: '',
            registerAs: 'student'
        })

        // Admin components 
        const adminStats = ref({})
        const companies = ref([])
        const students = ref([])
        const drives = ref([])
        const applications = ref([])
        const adminSearch = ref('')

        // Company components 
        const companyDashboard = ref({})
        const companyApplications = ref([])
        const selectedDriveId = ref(null)
        const driveForm = ref({
            drive_name: '', job_title: '', job_description: '',
            salary: '', location: '', required_branch: 'Any',
            required_cgpa: 0, required_year: '', application_deadline: ''
        })
        const showDriveForm = ref(false)

        // student components
        const studentDrives = ref([])
        const studentApplications = ref([])
        const studentProfile = ref({})
        const studentSearch = ref('')
        const studentView = ref('drives') 
        const editingProfile = ref(false)
        const profileForm = ref({})

        // helper functions 
        function authHeaders(){
            return{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.value}`
            }
        }

        async function api(method, url, body=null){          // url - endpoint, body - data to send
            const opts ={ method, headers: authHeaders() }
            if (body) opts.body = JSON.stringify(body)

            const res = await fetch(url, opts)
            const data = await res.json()

            return{ ok: res.ok, 
                data,
                status: res.status }
        }

        // Authentication functions 
        async function login(){
            error.value = ''
            const{ ok, data } = await api('POST', '/api/auth/login', loginForm.value)

            if (!ok){ 
                error.value = data.message; 
                return
            }

            localStorage.setItem('token', data.token)
            localStorage.setItem('role', data.role)

            token.value = data.token
            role.value = data.role
            page.value = data.role

            if (data.role === 'admin') loadAdminData()
            if (data.role === 'company') loadCompanyData()
            if (data.role === 'student') loadStudentData()
        }

        async function register(){
            error.value = ''
            const endpoint = registerForm.value.registerAs === 'student'
                ? '/api/auth/register/student'
                : '/api/auth/register/company'

            const{ ok, data } = await api('POST', endpoint, registerForm.value)
            if (!ok){ 
                error.value = data.message; 
                return 
            }

            success.value = data.message
            page.value = 'login'
        }

        function logout(){
            localStorage.clear()
            token.value = null
            role.value = null
            page.value = 'login'
            error.value = ''
            success.value = ''
        }

        // Admin functionalities 
        async function loadAdminData(){
            const{ data: stats } = await api('GET', '/api/admin/stats')
            adminStats.value = stats
            const{ data: company } = await api('GET', '/api/admin/companies')
            companies.value = company
            const{ data: student } = await api('GET', '/api/admin/students')
            students.value = student
            const{ data: drive } = await api('GET', '/api/admin/drives')
            drives.value = drive
            const{ data: apps } = await api('GET', '/api/admin/applications')
            applications.value = apps
        }

        async function updateCompanyStatus(id, status){
            const{ ok } = await api('PUT', `/api/admin/companies/${id}/status`,{ status })
            if (ok) loadAdminData()
        }

        async function updateDriveStatus(id, status){
            const{ ok } = await api('PUT', `/api/admin/drives/${id}/status`,{ status })
            if (ok) loadAdminData()
        }

        async function toggleStudent(id, is_active){
            const{ ok } = await api('PUT', `/api/admin/students/${id}/status`,{ is_active })
            if (ok) loadAdminData()
        }

        async function searchAdmin(){
            const{ data: company } = await api('GET', `/api/admin/companies?search=${adminSearch.value}`)
            companies.value = company
            const{ data: student } = await api('GET', `/api/admin/students?search=${adminSearch.value}`)
            students.value = student
        }

        // companies function 
        async function loadCompanyData(){
            const{ data } = await api('GET', '/api/company/dashboard')
            companyDashboard.value = data
        }

        async function createDrive(){
            const{ ok, data } = await api('POST', '/api/company/drives', driveForm.value)

            if (!ok){
                 error.value = data.message; 
                 return
            }
            success.value = data.message
            showDriveForm.value = false
            loadCompanyData()
        }

        async function loadDriveApplications(driveId){
            selectedDriveId.value = driveId
            const{ data } = await api('GET', `/api/company/drives/${driveId}/applications`)
            companyApplications.value = data
        }

        async function updateAppStatus(appId, status){
            await api('PUT', `/api/company/applications/${appId}/status`,{ status })
            loadDriveApplications(selectedDriveId.value)
        }

        // student functions 
        async function loadStudentData(){
            const{ data: drive } = await api('GET', '/api/student/drives')
            studentDrives.value = drive
            const{ data: apps } = await api('GET', '/api/student/applications')
            studentApplications.value = apps
            const{ data: profile } = await api('GET', '/api/student/profile')
            studentProfile.value = profile
            profileForm.value ={ ...profile }
        }

        async function applyDrive(driveId){
            const{ ok, data } = await api('POST', `/api/student/drives/${driveId}/apply`)
            if (!ok){ 
                error.value = data.message
                return 
            }
            success.value = data.message
            loadStudentData()
        }

        async function searchDrives(){
            const{ data } = await api('GET', `/api/student/drives?search=${studentSearch.value}`)
            studentDrives.value = data
        }

        async function saveProfile(){
            const{ ok, data } = await api('PUT', '/api/student/profile', profileForm.value)
            if (!ok){ error.value = data.message; return }
            success.value = data.message
            editingProfile.value = false
            loadStudentData()
        }

        async function exportCSV(){
            const{ ok, data } = await api('POST', '/api/student/export')
            if (ok) success.value = data.message
        }

        async function uploadResume(event) {
            const file = event.target.files[0]
            if (!file) return

            const formData = new FormData()
            formData.append('resume', file)

            const res = await fetch('/api/student/upload-resume', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token.value}` },
                body: formData
            })
            const data = await res.json()
            if (res.ok) {
                success.value = data.message
                loadStudentData()
            } else {
                error.value = data.message
            }
        }

        // IF already logged in 
        if (token.value && role.value){
            page.value = role.value
            if (role.value === 'admin') loadAdminData()
            if (role.value === 'company') loadCompanyData()
            if (role.value === 'student') loadStudentData()
        }

        return{
            page, token, role, error, success,
            loginForm, registerForm,
            adminStats, companies, students, drives, applications, adminSearch,
            companyDashboard, companyApplications, selectedDriveId, driveForm, showDriveForm,
            studentDrives, studentApplications, studentProfile, studentSearch, studentView,
            editingProfile, profileForm,
            login, register, logout,
            updateCompanyStatus, updateDriveStatus, toggleStudent, searchAdmin,
            createDrive, loadDriveApplications, updateAppStatus,
            applyDrive, searchDrives, saveProfile, exportCSV, uploadResume
        }
    },

    template: `
    <div>

    <!-- LOGIN PAGE -->

    <div v-if="page === 'login'" class="container mt-5" style="max-width:420px">
        <h3 class="text-center mb-4">Placement Portal</h3>
        <div class="card p-4 shadow-sm">
            <div v-if="error" class="alert alert-danger">[[ error ]]</div>
            <div v-if="success" class="alert alert-success">[[ success ]]</div>
            <div class="mb-3">
                <label class="form-label">Email</label>
                <input v-model="loginForm.email" type="email" class="form-control">
            </div>
            <div class="mb-3">
                <label class="form-label">Password</label>
                <input v-model="loginForm.password" type="password" class="form-control">
            </div>
            <button @click="login" class="btn btn-primary w-100">Login</button>
            <p class="text-center mt-3 mb-0">No account? <a href="#" @click="page='register'">Register</a></p>
        </div>
    </div>

    <!-- Register  -->

    <div v-else-if="page === 'register'" class="container mt-5" style="max-width:500px">
        <h3 class="text-center mb-4">Register</h3>
        <div class="card p-4 shadow-sm">
            <div v-if="error" class="alert alert-danger">[[ error ]]</div>
            <div class="mb-3">
                <label class="form-label">Register As</label>
                <select v-model="registerForm.registerAs" class="form-select">
                    <option value="student">Student</option>
                    <option value="company">Company</option>
                </select>
            </div>
            <input v-model="registerForm.username" placeholder="Username" class="form-control mb-2">
            <input v-model="registerForm.email" placeholder="Email" type="email" class="form-control mb-2">
            <input v-model="registerForm.password" placeholder="Password" type="password" class="form-control mb-3">
            <template v-if="registerForm.registerAs === 'student'">
                <input v-model="registerForm.full_name" placeholder="Full Name" class="form-control mb-2">
                <input v-model="registerForm.branch" placeholder="Branch (e.g. CSE)" class="form-control mb-2">
                <input v-model="registerForm.cgpa" placeholder="CGPA" type="number" step="0.1" class="form-control mb-2">
                <input v-model="registerForm.year" placeholder="Year" type="number" class="form-control mb-2">
                <input v-model="registerForm.phone" placeholder="Phone" class="form-control mb-3">
            </template>
            <template v-else>
                <input v-model="registerForm.company_name" placeholder="Company Name" class="form-control mb-2">
                <input v-model="registerForm.hr_contact" placeholder="HR Contact" class="form-control mb-2">
                <input v-model="registerForm.website" placeholder="Website" class="form-control mb-2">
                <textarea v-model="registerForm.description" placeholder="Company Description" class="form-control mb-3"></textarea>
            </template>
            <button @click="register" class="btn btn-success w-100">Register</button>
            <p class="text-center mt-3 mb-0">Already registered? <a href="#" @click="page='login'">Login</a></p>
        </div>
    </div>

    <!--Admin Dashboard-->

    <div v-else-if="page === 'admin'" class="container-fluid p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3>Admin Dashboard</h3>
            <button @click="logout" class="btn btn-outline-secondary btn-sm">Logout</button>
        </div>

        <!-- Stats -->

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
                    <h2>[[ adminStats.pending_companies ]]</h2><p class="mb-0">Pending Approvals</p>
                </div>
            </div>
        </div>

        <!-- Search -->
        <div class="input-group mb-4" style="max-width:400px">
            <input v-model="adminSearch" class="form-control" placeholder="Search companies or students...">
            <button @click="searchAdmin" class="btn btn-outline-primary">Search</button>
        </div>

        <!-- Companies Table -->
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
                                    'badge bg-warning': c.approval_status === 'pending',
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

        <!-- Drives Table -->

        <div class="card mb-4">
            <div class="card-header">Placement Drives</div>
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
                                    'badge bg-warning': d.status === 'pending',
                                    'badge bg-success': d.status === 'approved',
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

        <!-- Students Table -->

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

        <!-- Applications Table -->

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

    <!-- Company Dashboard -->

    <div v-else-if="page === 'company'" class="container-fluid p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3>Company Dashboard</h3>
            <button @click="logout" class="btn btn-outline-secondary btn-sm">Logout</button>
        </div>

        <!-- Company's Info -->
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

        <div v-if="companyDashboard.company && companyDashboard.company.approval_status !== 'approved'"
             class="alert alert-warning">
            Your company is pending admin approval. You cannot create drives yet.
        </div>

        <!-- Create Drive -->
        <div class="mb-3" v-if="companyDashboard.company && companyDashboard.company.approval_status === 'approved'">
            <button @click="showDriveForm = !showDriveForm" class="btn btn-primary">
                [[ showDriveForm ? 'Cancel' : '+ Create Drive' ]]
            </button>
        </div>

        <!-- Create Drive Form -->
        <div class="card p-4 mb-4" v-if="showDriveForm">
            <h5>New Placement Drive</h5>
            <div v-if="error" class="alert alert-danger">[[ error ]]</div>
            <div class="row">
                <div class="col-md-6 mb-2">
                    <input v-model="driveForm.drive_name" placeholder="Drive Name" class="form-control">
                </div>
                <div class="col-md-6 mb-2">
                    <input v-model="driveForm.job_title" placeholder="Job Title" class="form-control">
                </div>
                <div class="col-12 mb-2">
                    <textarea v-model="driveForm.job_description" placeholder="Job Description" class="form-control"></textarea>
                </div>
                <div class="col-md-4 mb-2">
                    <input v-model="driveForm.salary" placeholder="Salary (e.g. 6 LPA)" class="form-control">
                </div>
                <div class="col-md-4 mb-2">
                    <input v-model="driveForm.location" placeholder="Location" class="form-control">
                </div>
                <div class="col-md-4 mb-2">
                    <input v-model="driveForm.application_deadline" type="date" class="form-control">
                </div>
                <div class="col-md-4 mb-2">
                    <input v-model="driveForm.required_branch" placeholder="Branch (Any / CSE,ECE)" class="form-control">
                </div>
                <div class="col-md-4 mb-2">
                    <input v-model="driveForm.required_cgpa" placeholder="Min CGPA" type="number" step="0.1" class="form-control">
                </div>
                <div class="col-md-4 mb-2">
                    <input v-model="driveForm.required_year" placeholder="Year (e.g. 4)" type="number" class="form-control">
                </div>
            </div>
            <button @click="createDrive" class="btn btn-success mt-2">Submit Drive</button>
        </div>

        <!-- Drives Table -->

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
                            <td><span class="badge bg-secondary">[[ d.status ]]</span></td>
                            <td>
                                <button @click="loadDriveApplications(d.id)" class="btn btn-info btn-sm text-white">View Applications</button>
                            </td>
                        </tr>
                        <tr v-if="!companyDashboard.drives || companyDashboard.drives.length === 0">
                            <td colspan="6" class="text-center text-muted">No drives yet</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Applications for selected drive -->

        <div class="card mb-4" v-if="selectedDriveId">
            <div class="card-header"><strong>Applications</strong></div>
            <div class="card-body p-0">
                <table class="table table-hover mb-0">
                    <thead><tr><th>Student</th><th>Branch</th><th>CGPA</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        <tr v-for="a in companyApplications" :key="a.id">
                            <td>[[ a.student_name ]]</td>
                            <td>[[ a.branch ]]</td>
                            <td>[[ a.cgpa ]]</td>

                            <td>
                                <a v-if="a.resume_path" 
                                :href="'/api/student/resume/' + a.resume_path" 
                                target="_blank" class="btn btn-sm btn-outline-secondary">Resume</a>
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
                            </td>
                        </tr>
                        <tr v-if="companyApplications.length === 0">
                            <td colspan="5" class="text-center text-muted">No applications yet</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Student Dasboard -->

    <div v-else-if="page === 'student'" class="container-fluid p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3>Welcome, [[ studentProfile.full_name || 'Student' ]]</h3>
            <div>
                <button @click="studentView='drives'" class="btn btn-sm btn-outline-primary me-1">Drives</button>
                <button @click="studentView='applications'" class="btn btn-sm btn-outline-primary me-1">My Applications</button>
                <button @click="studentView='profile'" class="btn btn-sm btn-outline-secondary me-1">Profile</button>
                <button @click="logout" class="btn btn-sm btn-outline-danger">Logout</button>
            </div>
        </div>

        <div v-if="error" class="alert alert-danger">[[ error ]]</div>
        <div v-if="success" class="alert alert-success">[[ success ]]</div>

        <!-- Drives View -->

        <div v-if="studentView === 'drives'">
            <div class="input-group mb-3" style="max-width:400px">
                <input v-model="studentSearch" class="form-control" placeholder="Search drives...">
                <button @click="searchDrives" class="btn btn-outline-primary">Search</button>
            </div>
            <div class="row">
                <div class="col-md-4 mb-3" v-for="d in studentDrives" :key="d.id">
                    <div class="card h-100 shadow-sm">
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
                            <button v-if="!d.already_applied" @click="applyDrive(d.id)" class="btn btn-primary btn-sm w-100">Apply</button>
                            <button v-else class="btn btn-secondary btn-sm w-100" disabled>Already Applied</button>
                        </div>
                    </div>
                </div>
                <div v-if="studentDrives.length === 0" class="col-12 text-center text-muted">No approved drives available</div>
            </div>
        </div>

        <!-- Applications View -->

        <div v-if="studentView === 'applications'">
            <h5 class="mb-3">My Application History</h5>
            <table class="table table-hover">
                <thead><tr><th>Drive</th><th>Company</th><th>Job Title</th><th>Applied</th><th>Status</th></tr></thead>
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
                    </tr>
                    <tr v-if="studentApplications.length === 0">
                        <td colspan="6" class="text-center text-muted">No applications yet</td>
                    </tr>
                </tbody>
            </table>

            <button @click="exportCSV" class="btn btn-outline-success btn-sm mb-3">
                Export My Applications (CSV)
            </button>
        </div>

        <!-- Profile View -->

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
                    <a v-if="studentProfile.resume_path"
                    :href="'/api/student/resume/' + studentProfile.resume_path"
                    target="_blank" class="btn btn-sm btn-outline-info ms-2">View Resume</a>
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
                <input v-model="profileForm.branch" placeholder="Branch" class="form-control mb-2">
                <input v-model="profileForm.cgpa" placeholder="CGPA" type="number" step="0.1" class="form-control mb-2">
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