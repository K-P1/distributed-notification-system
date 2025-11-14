# Sample Templates for Testing

This directory contains sample templates that can be loaded into the Template Service for testing.

## Welcome Email Template

**Code:** `welcome_email`
**Language:** `en`

```json
{
  "code": "welcome_email",
  "language": "en",
  "subject": "Welcome to Our Platform, {{name}}!",
  "body_html": "<html><body><h1>Hello {{name}}!</h1><p>Thank you for joining us. Click <a href='{{link}}'>here</a> to get started.</p><p>Best regards,<br>The Team</p></body></html>",
  "body_text": "Hello {{name}}! Thank you for joining us. Visit: {{link}} to get started. Best regards, The Team"
}
```

**Variables:**

- `name` - User's full name
- `link` - Action link URL

---

## Password Reset Template

**Code:** `password_reset`
**Language:** `en`

```json
{
  "code": "password_reset",
  "language": "en",
  "subject": "Reset Your Password",
  "body_html": "<html><body><h1>Password Reset Request</h1><p>We received a request to reset your password. Click the button below to proceed:</p><p><a href='{{reset_link}}' style='background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;'>Reset Password</a></p><p>If you didn't request this, please ignore this email.</p></body></html>",
  "body_text": "Password Reset Request. We received a request to reset your password. Visit: {{reset_link}} If you didn't request this, please ignore this email."
}
```

**Variables:**

- `reset_link` - Password reset URL

---

## Order Confirmation Template

**Code:** `order_confirmation`
**Language:** `en`

```json
{
  "code": "order_confirmation",
  "language": "en",
  "subject": "Order Confirmation #{{order_id}}",
  "body_html": "<html><body><h1>Thank you for your order, {{name}}!</h1><p>Your order #{{order_id}} has been confirmed.</p><p><strong>Order Total:</strong> ${{total}}</p><p>Track your order: <a href='{{tracking_link}}'>{{tracking_link}}</a></p></body></html>",
  "body_text": "Thank you for your order, {{name}}! Your order #{{order_id}} has been confirmed. Order Total: ${{total}}. Track your order: {{tracking_link}}"
}
```

**Variables:**

- `name` - Customer name
- `order_id` - Order ID
- `total` - Order total amount
- `tracking_link` - Order tracking URL

---

## Push Notification Template

**Code:** `new_message`
**Language:** `en`

```json
{
  "code": "new_message",
  "language": "en",
  "subject": "New message from {{sender}}",
  "body_html": "<html><body><h2>{{sender}} sent you a message</h2><p>{{message}}</p><p><a href='{{link}}'>View Message</a></p></body></html>",
  "body_text": "{{sender}} sent you a message: {{message}}. View: {{link}}"
}
```

**Variables:**

- `sender` - Sender's name
- `message` - Message preview
- `link` - Link to view full message

---

## Loading Templates

Use the PowerShell script to load these templates:

```powershell
cd c:\Users\hamed\Desktop\distributed-notification-system\services\template
.\test_template_service.ps1
```

Or use curl/Invoke-RestMethod to create them individually via the API.
