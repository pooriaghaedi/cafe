import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import SessionLocal, engine
import models
from fastapi.middleware.cors import CORSMiddleware
from routers import menu

# Create database tables if they don't exist
models.Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Cafe Order Management API with PostgreSQL",
    description="Tracks table occupancy, order timings, preparation durations, and departures.",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with frontend URL if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(menu.router)

# ---------------------------
# Database Dependency
# ---------------------------
def get_db():
    """Dependency to get DB session."""
    with SessionLocal() as db:
        yield db


# -----------------------------------------
# Pydantic Schemas
# -----------------------------------------
class TableCreate(BaseModel):
    table_id: str


class TableOccupy(BaseModel):
    table_id: str


class OrderCreate(BaseModel):
    table_id: int
    items: List[str] 


# Response Models
class CafeTableResponse(BaseModel):
    table_id: str
    occupied_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None

    class Config:
        from_attributes = True  # Supports ORM mode


class OrderResponse(BaseModel):
    order_id: str
    table_id: str
    order_time: datetime
    ready_time: Optional[datetime] = None
    preparation_time: Optional[str] = None
    items: List[str]

    class Config:
        from_attributes = True


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
# -----------------------------------------
# API Endpoints for Cafe Tables
# -----------------------------------------
@app.post(
    "/tables",
    tags=["Tables"],
    summary="Create a new cafe table",
    response_model=CafeTableResponse
)
def create_cafe_table(table_data: TableCreate, db: Session = Depends(get_db)):
    """Creates a new cafe table."""
    existing_table = db.query(models.CafeTable).filter_by(table_id=table_data.table_id).first()
    if existing_table:
        raise HTTPException(status_code=400, detail="Table already exists")

    new_table = models.CafeTable(table_id=table_data.table_id)
    db.add(new_table)
    try:
        db.commit()
        db.refresh(new_table)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create table due to a database error.")

    return new_table


@app.get(
    "/tables",
    tags=["Tables"],
    summary="Retrieve all cafe tables",
    response_model=List[CafeTableResponse]
)
def get_tables(db: Session = Depends(get_db)):
    """Retrieves all cafe tables."""
    return db.query(models.CafeTable).all()


@app.get(
    "/free-tables",
    tags=["Tables"],
    summary="Retrieve available cafe tables",
    response_model=List[dict]  # Returns a simplified structure
)
def get_available_tables(db: Session = Depends(get_db)):
    """
    Retrieves only unoccupied tables.
    A table is considered 'free' if:
    - `occupied_time IS NULL` (Never occupied)
    - OR `departure_time IS NOT NULL` (Recently vacated)
    """
    free_tables = (
        db.query(models.CafeTable)
        .filter(
            (models.CafeTable.occupied_time.is_(None)) |
            (models.CafeTable.departure_time.isnot(None))
        )
        .all()
    )

    # Return simplified structure (without `occupied_time` and `departure_time`)
    return [{"table_id": table.table_id} for table in free_tables]


@app.post(
    "/tables/occupy",
    tags=["Tables"],
    summary="Mark a table as occupied",
    response_model=CafeTableResponse
)
def occupy_table(data: TableOccupy, db: Session = Depends(get_db)):
    """Marks a table as occupied."""
    table = db.query(models.CafeTable).filter_by(table_id=data.table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table.occupied_time = datetime.utcnow()
    db.commit()
    db.refresh(table)

    return table


@app.put(
    "/tables/{table_id}/leave",
    tags=["Tables"],
    summary="Mark a table as vacated",
    response_model=CafeTableResponse
)
def vacate_table(table_id: str, db: Session = Depends(get_db)):
    """Marks a table as vacated."""
    table = db.query(models.CafeTable).filter_by(table_id=table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table.departure_time = datetime.utcnow()
    db.commit()
    db.refresh(table)

    return table


# -----------------------------------------
# API Endpoints for Orders
# -----------------------------------------
@app.post(
    "/orders",
    tags=["Orders"],
    summary="Place a new order",
    response_model=OrderResponse
)
def create_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    """Creates a new order for a table, only if the table is occupied."""
    now = datetime.utcnow()
    order_id = str(uuid.uuid4())

    # Ensure table_id is used as a string
    table = db.query(models.CafeTable).filter(models.CafeTable.table_id == str(order_data.table_id)).first()
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if not table.occupied_time:
        raise HTTPException(status_code=400, detail="Table is not occupied. Cannot place an order.")

    # Create order
    order = models.Order(
        order_id=order_id,
        table_id=str(order_data.table_id),  # Ensure this is stored as a string
        order_time=now,
        items=order_data.items
    )

    db.add(order)
    try:
        db.commit()
        db.refresh(order)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create order due to database error.")

    return order


@app.put(
    "/orders/{order_id}/ready",
    tags=["Orders"],
    summary="Mark an order as ready",
    response_model=OrderResponse
)
def mark_order_ready(order_id: str, db: Session = Depends(get_db)):
    """Marks an order as ready and checks if all orders for the table are completed."""
    now = datetime.utcnow()
    order = db.query(models.Order).filter_by(order_id=order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update order readiness
    order.ready_time = now
    order.preparation_time = str(now - order.order_time) if order.order_time else "N/A"

    db.commit()
    db.refresh(order)

    # Check if all orders for the table are completed
    table_orders = db.query(models.Order).filter_by(table_id=order.table_id).all()
    if all(o.ready_time is not None for o in table_orders):  # If all orders are ready
        table = db.query(models.CafeTable).filter_by(table_id=order.table_id).first()
        if table:
            table.departure_time = now  # Auto-vacate table
            db.commit()
            db.refresh(table)

    return order

@app.get(
    "/orders/{order_id}",
    tags=["Orders"],
    summary="Get order details",
    response_model=OrderResponse
)
def get_order(order_id: str, db: Session = Depends(get_db)):
    """Retrieves details of a specific order."""
    order = db.query(models.Order).filter_by(order_id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return order

@app.get(
    "/orders",
    tags=["Orders"],
    summary="Get all orders",
    response_model=list[OrderResponse]
)
def get_all_orders(db: Session = Depends(get_db)):
    """Retrieves all orders."""
    orders = db.query(models.Order).all()
    if not orders:
        raise HTTPException(status_code=404, detail="No orders found")
    return orders


@app.get(
    "/reports",
    tags=["Reports"],
    summary="Generate a report",
    response_model=dict
)
def generate_report(db: Session = Depends(get_db)):
    """Generates a summary report of all tables and orders."""
    tables = db.query(models.CafeTable).all()
    orders = db.query(models.Order).all()
    return {"tables": tables, "orders": orders}


# -----------------------------------------
# Run Server:
# -----------------------------------------
# uvicorn main:app --reload