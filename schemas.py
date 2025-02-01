from pydantic import BaseModel
from typing import Optional

class MenuItemCreate(BaseModel):
    """Schema for creating a new menu item."""
    name: str
    description: Optional[str] = None
    price: float

class MenuItemUpdate(BaseModel):
    """Schema for updating an existing menu item."""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None

class MenuItemResponse(BaseModel):
    """Schema for returning a menu item."""
    item_id: str
    name: str
    description: Optional[str]
    price: float

    class Config:
        from_attributes = True