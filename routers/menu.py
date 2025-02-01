from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid

from database import SessionLocal, engine
import models
from schemas import MenuItemCreate, MenuItemUpdate, MenuItemResponse

router = APIRouter(
    prefix="/menu",
    tags=["Menu"]
)

def get_db():
    """Dependency to get DB session."""
    with SessionLocal() as db:
        yield db

# ✅ Create a new menu item
@router.post("/", response_model=MenuItemResponse)
def create_menu_item(item: MenuItemCreate, db: Session = Depends(get_db)):
    """Create a new menu item."""
    existing_item = db.query(models.MenuItem).filter(models.MenuItem.name == item.name).first()
    if existing_item:
        raise HTTPException(status_code=400, detail="Item with this name already exists")

    new_item = models.MenuItem(
        item_id=str(uuid.uuid4()),
        name=item.name,
        description=item.description,
        price=item.price
    )

    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


# ✅ Get all menu items
@router.get("/", response_model=list[MenuItemResponse])
def get_menu(db: Session = Depends(get_db)):
    """Retrieve all menu items."""
    return db.query(models.MenuItem).all()


# ✅ Get a single menu item by ID
@router.get("/{item_id}", response_model=MenuItemResponse)
def get_menu_item(item_id: str, db: Session = Depends(get_db)):
    """Retrieve a specific menu item by ID."""
    item = db.query(models.MenuItem).filter(models.MenuItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


# ✅ Update a menu item
@router.put("/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: str, update_data: MenuItemUpdate, db: Session = Depends(get_db)):
    """Update a menu item's details."""
    item = db.query(models.MenuItem).filter(models.MenuItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if update_data.name:
        existing_item = db.query(models.MenuItem).filter(models.MenuItem.name == update_data.name).first()
        if existing_item and existing_item.item_id != item_id:
            raise HTTPException(status_code=400, detail="Another item with this name already exists")

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


# ✅ Delete a menu item
@router.delete("/{item_id}", response_model=dict)
def delete_menu_item(item_id: str, db: Session = Depends(get_db)):
    """Delete a menu item by ID."""
    item = db.query(models.MenuItem).filter(models.MenuItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    db.delete(item)
    db.commit()
    return {"message": "Menu item deleted successfully"}