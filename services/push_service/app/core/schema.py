from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime




class DeviceType(str, Enum):
    IOS = "ios"
    ANDROID = "android"
    WEB = "web"


class PushNotification(BaseModel):
    title: str = Field(..., max_length=100)
    body: str = Field(..., max_length=500)
    image: Optional[str] = None
    link: Optional[str] = None
    data: Optional[Dict[str, Any]] = {}
    
   

class DeviceToken(BaseModel):
    token: str
    device_type: DeviceType


class NotificationType(str, Enum):
    PUSH = "push"
    EMAIL = "email"



class TemplateData(BaseModel):
    template_code: str
    template_id: str
    type: NotificationType
    subject: str
    body: str
    is_active: bool = True
    version: int = 1


