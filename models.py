import uuid
from sqlalchemy import (
    Column, String, DateTime, Interval, ForeignKey, JSON, Float
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class CafeTable(Base):
    """Represents a table in the cafe."""
    
    __tablename__ = "tables"
    
    table_id = Column(String, primary_key=True, index=True)
    occupied_time = Column(DateTime, nullable=True, index=True)  # Tracks when the table was occupied
    departure_time = Column(DateTime, nullable=True, index=True)  # Tracks when the table was vacated

    # Relationship: One table can have many orders
    orders = relationship(
        "Order",
        back_populates="table",
        cascade="all, delete-orphan",
        lazy="joined"  # Optimizes related queries
    )

    def is_occupied(self):
        """Check if the table is currently occupied."""
        return self.occupied_time is not None and self.departure_time is None

    def vacate(self, session):
        """Mark the table as vacated."""
        self.departure_time = func.now()
        session.commit()
        session.refresh(self)

    def __repr__(self):
        return f"<CafeTable(table_id='{self.table_id}', occupied_time='{self.occupied_time}')>"


class Order(Base):
    """Represents an order in the cafe."""
    
    __tablename__ = "orders"

    order_id = Column(
        String,
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4())  # Generates a unique order ID
    )
    table_id = Column(
        String, ForeignKey("tables.table_id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_time = Column(DateTime, default=func.now(), nullable=False)  # When the order was placed
    ready_time = Column(DateTime, nullable=True)  # When the order was marked ready
    preparation_time = Column(Interval, nullable=True)  # Auto-calculated preparation duration
    items = Column(JSON, default=list)  # Stores ordered items in JSON format

    # Relationship: Each order is linked to a table
    table = relationship("CafeTable", back_populates="orders", lazy="joined")

    def mark_ready(self, session):
        """Mark the order as ready and calculate preparation time."""
        self.ready_time = func.now()
        if self.order_time:
            self.preparation_time = self.ready_time - self.order_time

        session.commit()
        session.refresh(self)

        # Check if all orders for the table are ready
        self.check_and_vacate_table(session)

    def check_and_vacate_table(self, session):
        """Check if all orders for the table are completed and vacate the table if true."""
        table_orders = session.query(Order).filter_by(table_id=self.table_id).all()
        if all(order.ready_time is not None for order in table_orders):
            table = session.query(CafeTable).filter_by(table_id=self.table_id).first()
            if table:
                table.vacate(session)

    def __repr__(self):
        return (
            f"<Order(order_id='{self.order_id}', table_id='{self.table_id}', "
            f"order_time='{self.order_time}', ready_time='{self.ready_time}')>"
        )


class MenuItem(Base):
    """Represents a menu item in the cafe."""
    
    __tablename__ = "menu"

    item_id = Column(String, primary_key=True, index=True)  # Unique identifier
    name = Column(String, nullable=False, unique=True)  # Item name (unique)
    description = Column(String, nullable=True)  # Item description
    price = Column(Float, nullable=False)  # Item price

    def __repr__(self):
        return f"<MenuItem(name='{self.name}', price={self.price})>"