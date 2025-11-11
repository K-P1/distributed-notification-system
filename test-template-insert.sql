INSERT INTO templates (name, description, template_type, content, variables, code) 
VALUES ('Test Email', 'Test email template', 'email', 
        '<h1>Hello {{name}}!</h1><p>This is a test.</p>', 
        '{"name": "string"}', 'TEST_EMAIL') 
ON CONFLICT (code) DO UPDATE SET content = EXCLUDED.content;

SELECT id, name, code, template_type, content FROM templates WHERE code = 'TEST_EMAIL';