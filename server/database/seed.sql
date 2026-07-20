-- =====================================================
-- Employee Management System — Seed Data
-- =====================================================

-- USE employee_management;

-- ---------------------
-- Seed Roles
-- ---------------------
INSERT IGNORE INTO roles (name, description, hierarchy_level) VALUES
('super_admin', 'Super Administrator with full system access', 1),
('admin', 'Administrator with user and system management access', 2),
('manager', 'Department manager with team oversight and approval authority', 3),
('employee', 'Regular employee with self-service access', 4);

-- ---------------------
-- Seed Departments
-- ---------------------
INSERT IGNORE INTO departments (name, description) VALUES
('Engineering', 'Software development and technical operations'),
('Human Resources', 'Employee relations, recruitment, and HR operations'),
('Finance', 'Financial planning, accounting, and budgeting'),
('Marketing', 'Brand management, campaigns, and communications'),
('Operations', 'Day-to-day operational management and logistics');

-- ---------------------
-- Seed Leave Types
-- ---------------------
INSERT IGNORE INTO leave_types (name, days_per_year, is_carry_forward, description) VALUES
('Casual Leave', 12, FALSE, 'For personal matters and short-term needs'),
('Sick Leave', 6, FALSE, 'For health-related absences with medical certificate if more than 2 days'),
('Earned Leave', 15, TRUE, 'Accumulated paid leave that can be carried forward');

-- ---------------------
-- Seed Expense Categories
-- ---------------------
INSERT IGNORE INTO expense_categories (name, max_amount, description) VALUES
('Travel', 50000.00, 'Business travel expenses including flights, trains, and taxis'),
('Food & Meals', 5000.00, 'Business meals and client dining'),
('Accommodation', 30000.00, 'Hotel and lodging for business trips'),
('Office Supplies', 10000.00, 'Stationery, equipment, and office materials'),
('Client Entertainment', 15000.00, 'Client meetings, events, and entertainment expenses'),
('Miscellaneous', 5000.00, 'Other business-related expenses');

-- ---------------------
-- Seed Office Location (Default)
-- ---------------------
INSERT IGNORE INTO office_locations (name, address, latitude, longitude, radius_meters) VALUES
('Head Office', '123 Business Park, Tech City', 28.61390000, 77.20900000, 200);

-- ---------------------
-- Seed Default Super Admin User
-- Password: Admin@123 (bcrypt hashed)
-- ---------------------
INSERT IGNORE INTO users (employee_id, first_name, last_name, email, password_hash, phone, role_id, department_id, designation, date_of_joining)
SELECT 'EMP-001', 'System', 'Administrator', 'admin@company.com', 
    '$2b$10$67XJHpDB4z.ErofhWFhs/eOB8OZf9VxWJeslvXjcZ7/ehdulI/O6.',
    '+91-9999999999',
    r.id, d.id, 'Super Administrator', CURDATE()
FROM roles r, departments d
WHERE r.name = 'super_admin' AND d.name = 'Human Resources'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@company.com');

-- ---------------------
-- Initialize leave balances for the admin user
-- ---------------------
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, remaining_days)
SELECT u.id, lt.id, YEAR(CURDATE()), lt.days_per_year, lt.days_per_year
FROM users u
CROSS JOIN leave_types lt
WHERE u.email = 'admin@company.com';
