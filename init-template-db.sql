-- Create template service schema
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    version INTEGER DEFAULT 1,
    code VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    change_notes TEXT,
    UNIQUE(template_id, version)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_templates_code ON templates(code);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_active ON template_versions(is_active);

-- Insert some sample data for testing
INSERT INTO templates (name, description, template_type, content, variables, code) VALUES 
('Welcome Email', 'Welcome email for new users', 'email', 
'<h1>Welcome {{firstName}}!</h1><p>Thank you for joining {{appName}}. Your account is now active.</p>', 
'{"firstName": "string", "appName": "string"}', 'WELCOME_EMAIL')
ON CONFLICT (code) DO NOTHING;

INSERT INTO templates (name, description, template_type, content, variables, code) VALUES 
('Password Reset', 'Password reset email template', 'email', 
'<h1>Reset Your Password</h1><p>Hi {{firstName}},</p><p>Click <a href="{{resetLink}}">here</a> to reset your password.</p>', 
'{"firstName": "string", "resetLink": "string"}', 'PASSWORD_RESET')
ON CONFLICT (code) DO NOTHING;