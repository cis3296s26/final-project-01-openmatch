from pydantic import BaseModel, Field, EmailStr, field_validator

class UserCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    username: str = Field(..., min_length=1, max_length=40)
    password: str = Field(..., min_length=8)

    @field_validator("email", "username")
    @classmethod
    def to_lowercase(cls, v: str) -> str:
        return v.lower()
    
class UserLogin(BaseModel):
    login: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)