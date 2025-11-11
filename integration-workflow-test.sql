-- Integration Test: Complete Email Template Workflow
-- This script demonstrates the full workflow from template creation to email preparation

-- 1. Create an email template with variables
INSERT INTO templates (name, description, template_type, content, variables, code) 
VALUES (
    'User Welcome Email',
    'Welcome email sent to new users with personalized content', 
    'email',
    '
    <html>
    <head><title>Welcome to {{appName}}</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50;">Welcome {{firstName}}!</h1>
            <p>Thank you for joining <strong>{{appName}}</strong>. Your account is now active and ready to use.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Account Details:</h3>
                <ul>
                    <li><strong>Email:</strong> {{email}}</li>
                    <li><strong>Account Type:</strong> {{accountType}}</li>
                    <li><strong>Registration Date:</strong> {{registrationDate}}</li>
                </ul>
            </div>
            <p>To get started, please visit our <a href="{{dashboardUrl}}" style="color: #4CAF50;">user dashboard</a>.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
                If you have any questions, please contact our support team at {{supportEmail}}.
                <br>Best regards,<br>The {{appName}} Team
            </p>
        </div>
    </body>
    </html>
    ',
    '{
        "firstName": "string",
        "email": "string", 
        "appName": "string",
        "accountType": "string",
        "registrationDate": "string",
        "dashboardUrl": "string",
        "supportEmail": "string"
    }',
    'USER_WELCOME_EMAIL'
) ON CONFLICT (code) DO UPDATE SET 
    content = EXCLUDED.content,
    variables = EXCLUDED.variables;

-- 2. Create a template version (simulating versioning system)
INSERT INTO template_versions (template_id, version, content, variables, is_active, created_by, change_notes)
SELECT id, 1, content, variables, true, 'system_test', 'Initial version for integration testing'
FROM templates WHERE code = 'USER_WELCOME_EMAIL'
ON CONFLICT (template_id, version) DO UPDATE SET is_active = EXCLUDED.is_active;

-- 3. Query the complete template information (simulating API retrieval)
SELECT 
    t.id,
    t.name,
    t.code,
    t.template_type,
    t.content,
    t.variables,
    t.is_active,
    t.created_at,
    tv.version,
    tv.is_active as version_active
FROM templates t
LEFT JOIN template_versions tv ON t.id = tv.template_id AND tv.is_active = true
WHERE t.code = 'USER_WELCOME_EMAIL';

-- 4. Simulate template rendering with sample data
-- (This would normally be done by the application, but we're showing the concept)
COMMENT ON TABLE templates IS 'Integration test demonstrates:
1. Template creation with complex HTML and multiple variables
2. Version management for template evolution  
3. Template retrieval by code (API simulation)
4. Variable structure for rendering engine

Sample rendering data would be:
{
    "firstName": "Alice Smith",
    "email": "alice@example.com",
    "appName": "Distributed Notification System", 
    "accountType": "Premium User",
    "registrationDate": "November 11, 2025",
    "dashboardUrl": "https://app.example.com/dashboard", 
    "supportEmail": "support@example.com"
}

Expected rendered output would replace all {{variable}} placeholders with actual values.
';

-- 5. Show template statistics (simulating metrics endpoint)
SELECT 
    COUNT(*) as total_templates,
    COUNT(CASE WHEN template_type = 'email' THEN 1 END) as email_templates,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_templates,
    MIN(created_at) as oldest_template,
    MAX(created_at) as newest_template
FROM templates;