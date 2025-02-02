// -----------------------
// Global Config & Variables
// -----------------------
const API_BASE_URL = "http://localhost:8000"; // Centralized API endpoint
let menuItems = []; // Loaded from the /menu endpoint
let selectedMenuItems = []; // Items selected in the order form

// -----------------------
// Utility Functions
// -----------------------

// Debounce: delays execution until user stops typing.
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Show a loader with a spinner animation
function showLoader(container) {
  container.innerHTML = `
    <div class="flex justify-center items-center p-4">
      <div class="spinner border-t-4 border-b-4 border-blue-500 rounded-full w-8 h-8 animate-spin"></div>
    </div>`;
}

// Modal open/close helper functions with fade animations
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove("hidden", "fade-out");
  modal.classList.add("fade-in");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove("fade-in");
  modal.classList.add("fade-out");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("fade-out");
  }, 300);
}

// -----------------------
// API Fetch Functions
// -----------------------

// Fetch menu items from the API.
// The endpoint /menu should return an array of menu items.
// Each item should have: item_id, name, description, price.
async function fetchMenuItems() {
  try {
    const response = await fetch(`${API_BASE_URL}/menu`);
    if (!response.ok) throw new Error("Failed to fetch menu items");
    menuItems = await response.json();
    console.log("Menu Items Loaded:", menuItems);
  } catch (error) {
    console.error("Error fetching menu items:", error);
  }
}

// Fetch orders from the API.
async function fetchOrders() {
  try {
    const response = await fetch(`${API_BASE_URL}/orders`);
    if (!response.ok) throw new Error("Failed to fetch orders");
    return await response.json();
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

// Fetch tables and orders concurrently and then render tables.
async function fetchTables() {
  try {
    const [tablesResponse, orders] = await Promise.all([
      fetch(`${API_BASE_URL}/tables`),
      fetchOrders(),
    ]);
    if (!tablesResponse.ok) throw new Error("Failed to fetch tables");
    const tables = await tablesResponse.json();

    // Build a mapping of table_id to list of orders.
    const ordersMapping = {};
    orders.forEach((order) => {
      if (!ordersMapping[order.table_id]) {
        ordersMapping[order.table_id] = [];
      }
      ordersMapping[order.table_id].push(order);
    });

    renderTables(tables, ordersMapping);
  } catch (error) {
    console.error("Error fetching tables:", error);
    alert("Unable to load tables. Please try again later.");
  }
}

// -----------------------
// Table Rendering & Actions
// -----------------------
// -----------------------
// Table Rendering & Actions
// -----------------------
function renderTables(tables, ordersMapping = {}) {
  const tableList = document.getElementById("tableList");
  tableList.innerHTML = "";

  tables.forEach((table) => {
    // Determine if the table is occupied:
    // A table is considered occupied if it has an occupied_time and no departure_time.
    const isOccupied = !!table.occupied_time && !table.departure_time;

    // Only display orders if the table is occupied.
    let ordersHTML = "";
    if (isOccupied && ordersMapping[table.table_id]) {
      ordersMapping[table.table_id].forEach((order) => {
        // Map each item ID to its corresponding name using the global menuItems array.
        const itemNames = order.items.map((itemId) => {
          const menuItem = menuItems.find((item) => item.item_id === itemId);
          return menuItem ? menuItem.name : itemId;
        });
        ordersHTML += `
          <div class="order-item bg-gray-100 p-2 mt-2 rounded">
            <p class="text-sm"><strong>Items:</strong> ${itemNames.join(
              ", "
            )}</p>
          </div>
        `;
      });
    }

    // Build the table card.
    const card = document.createElement("div");
    card.className =
      "table-card bg-white rounded-lg shadow p-4 flex flex-col relative mb-4 transform hover:scale-105 transition-transform";
    card.dataset.tableId = table.table_id;

    card.innerHTML = `
      <h3 class="text-xl font-bold mb-2">Table ${table.table_id}</h3>
      <p>Status: <span class="font-semibold">${
        isOccupied ? "Occupied" : "Free"
      }</span></p>
      ${ordersHTML}
      ${
        isOccupied
          ? `<div class="flex justify-between items-center mt-4">
               <button data-table-id="${table.table_id}" class="orderBtn bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded w-full">Order</button>
               <img src="vacate-logo.png" alt="Vacate" class="vacateIcon cursor-pointer" style="width:30px; height:30px; position:absolute; top:10px; right:10px;">
             </div>`
          : `<button data-table-id="${table.table_id}" class="occupyBtn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mt-4 w-full">Occupy</button>`
      }
    `;
    tableList.appendChild(card);
  });

  attachTableEventListeners();
}

// Attach event listeners for table actions using event delegation.
function attachTableEventListeners() {
  document
    .getElementById("tableList")
    .addEventListener("click", async (event) => {
      const target = event.target;

      // Occupy table button clicked.
      if (target.classList.contains("occupyBtn")) {
        const tableId = target.dataset.tableId;
        document.getElementById(
          "occupyModalTableId"
        ).textContent = `Mark table ${tableId} as occupied?`;
        openModal("occupyModal");
        document.getElementById("occupyConfirmBtn").onclick = async () => {
          target.disabled = true;
          await occupyTable(tableId);
          closeModal("occupyModal");
          fetchTables();
          target.disabled = false;
        };
      }
      // Vacate table icon clicked.
      else if (target.classList.contains("vacateIcon")) {
        const tableCard = target.closest(".table-card");
        const tableId = tableCard
          ? tableCard.dataset.tableId
          : target.dataset.tableId;
        document.getElementById(
          "vacateModalTableId"
        ).textContent = `Vacate table ${tableId}?`;
        openModal("vacateModal");
        document.getElementById("vacateConfirmBtn").onclick = async () => {
          target.disabled = true;
          await vacateTable(tableId);
          // Optionally clear any pending order form data.
          resetOrderForm();
          closeModal("vacateModal");
          fetchTables();
          target.disabled = false;
        };
      }
      // Order button clicked.
      else if (target.classList.contains("orderBtn")) {
        const tableId = target.dataset.tableId;
        document.getElementById("orderTableId").value = tableId;
        openModal("orderModal");
      }
    });
}
// API call to mark a table as occupied.
async function occupyTable(tableId) {
  try {
    const response = await fetch(`${API_BASE_URL}/tables/occupy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: tableId }),
    });
    if (!response.ok) throw new Error("Failed to occupy table");
    console.log("Table occupied successfully.");
  } catch (error) {
    console.error("Error occupying table:", error);
    alert("Error marking table as occupied.");
  }
}

// API call to mark a table as vacated.
async function vacateTable(tableId) {
  try {
    const response = await fetch(`${API_BASE_URL}/tables/${tableId}/leave`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to vacate table");
    }
    console.log("Table vacated successfully.");
  } catch (error) {
    console.error("Error vacating table:", error);
    alert(error.message);
  }
}

// Create a new order using selected menu items.
async function createOrder(tableId, items) {
  try {
    if (!Array.isArray(items)) {
      throw new Error("Items must be an array.");
    }
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: tableId,
        items: items,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server Error:", errorData);
      throw new Error(errorData.detail || "Failed to create order.");
    }
    const order = await response.json();
    alert(`Order ${order.order_id} created successfully!`);
    closeModal("orderModal");
    resetOrderForm();
    fetchTables();
  } catch (error) {
    console.error("Error creating order:", error);
    alert("Error creating order. Please try again.");
  }
}

// -----------------------
// Menu Item Search & Selection
// -----------------------
const itemSearchInput = document.getElementById("itemSearch");
const suggestionsBox = document.getElementById("suggestions");

itemSearchInput.addEventListener(
  "input",
  debounce(function () {
    const query = this.value.toLowerCase().trim();
    suggestionsBox.innerHTML = "";
    if (!query) {
      suggestionsBox.classList.add("hidden");
      return;
    }
    const filteredItems = menuItems.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
    if (filteredItems.length === 0) {
      suggestionsBox.classList.add("hidden");
      return;
    }
    filteredItems.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.name;
      li.className = "p-2 cursor-pointer hover:bg-gray-200 transition-colors";
      li.dataset.itemId = item.item_id;
      li.addEventListener("click", () => selectMenuItem(item));
      suggestionsBox.appendChild(li);
    });
    suggestionsBox.classList.remove("hidden");
  }, 300)
);

function selectMenuItem(item) {
  // Prevent duplicates.
  if (selectedMenuItems.find((i) => i.item_id === item.item_id)) return;
  selectedMenuItems.push(item);
  updateSelectedItemsUI();

  // Clear search field and hide suggestions.
  itemSearchInput.value = "";
  suggestionsBox.classList.add("hidden");
}

function updateSelectedItemsUI() {
  const container = document.getElementById("selectedItemsContainer");
  container.innerHTML = "";
  selectedMenuItems.forEach((item) => {
    const tag = document.createElement("div");
    tag.className =
      "bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-2 mb-2";
    tag.textContent = item.name;
    const removeBtn = document.createElement("span");
    removeBtn.textContent = "✖";
    removeBtn.className = "cursor-pointer hover:text-gray-300";
    removeBtn.addEventListener("click", () => removeMenuItem(item.item_id));
    tag.appendChild(removeBtn);
    container.appendChild(tag);
  });
}

function removeMenuItem(itemId) {
  selectedMenuItems = selectedMenuItems.filter(
    (item) => item.item_id !== itemId
  );
  updateSelectedItemsUI();
}

function resetOrderForm() {
  document.getElementById("orderForm").reset();
  selectedMenuItems = [];
  updateSelectedItemsUI();
}

// -----------------------
// Initialization
// -----------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Setup global modal events (click outside or ESC key to close)
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal:not(.hidden)").forEach((modal) => {
        closeModal(modal.id);
      });
    }
  });

  // Show loader and concurrently fetch menu items and tables (with orders)
  const tableListEl = document.getElementById("tableList");
  showLoader(tableListEl);
  await Promise.all([fetchMenuItems(), fetchTables()]);

  // Setup modal cancel buttons.
  document.getElementById("occupyCancelBtn").addEventListener("click", () => {
    closeModal("occupyModal");
    fetchTables();
  });
  document.getElementById("vacateCancelBtn").addEventListener("click", () => {
    closeModal("vacateModal");
    fetchTables();
  });
  document.getElementById("orderCancelBtn").addEventListener("click", () => {
    closeModal("orderModal");
    resetOrderForm();
  });

  // Order form submission.
  document.getElementById("orderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const tableId = document.getElementById("orderTableId").value.trim();
    const selectedItemIds = selectedMenuItems.map((item) => item.item_id);
    if (!tableId) {
      alert("Table ID is missing.");
      return;
    }
    if (selectedItemIds.length === 0) {
      alert("Please select at least one item.");
      return;
    }
    await createOrder(tableId, selectedItemIds);
  });

  // Auto-refresh tables (and orders) every 10 seconds.
  setInterval(fetchTables, 10000);
});