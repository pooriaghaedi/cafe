// -----------------------
// Global variables
// -----------------------
let menuItems = [];
let selectedMenuItems = [];

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
  }, 300); // matches CSS transition duration
}

// Allow closing modal by clicking outside the content area
function setupModalCloseOnClick(modalId) {
  const modal = document.getElementById(modalId);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modalId);
    }
  });
}

// Allow closing modal with the Escape key
function setupModalCloseOnEsc(modalId) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById(modalId);
      if (!modal.classList.contains("hidden")) {
        closeModal(modalId);
      }
    }
  });
}

// -----------------------
// Initialization
// -----------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Show spinner in the table list container
  const tableListEl = document.getElementById("tableList");
  showLoader(tableListEl);

  // Fetch both tables and menu items before proceeding
  await Promise.all([fetchTables(), fetchMenuItems()]);

  // Setup modal close functionality (click outside and ESC key)
  ["occupyModal", "vacateModal", "orderModal"].forEach((modalId) => {
    setupModalCloseOnClick(modalId);
    setupModalCloseOnEsc(modalId);
  });

  // Setup close buttons for modals
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

  // Order form submission
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

  // Auto-refresh free tables every 10 seconds
  setInterval(fetchFreeTables, 10000);
});

// -----------------------
// Data Fetching Functions
// -----------------------
async function fetchTables() {
  try {
    const response = await fetch("http://localhost:8000/tables");
    if (!response.ok) throw new Error("Failed to fetch tables");
    const tables = await response.json();
    renderTables(tables);
  } catch (error) {
    console.error("Error fetching tables:", error);
    alert("Unable to load tables. Please try again later.");
  }
}

async function fetchFreeTables() {
  try {
    const response = await fetch("http://localhost:8000/free-tables");
    if (!response.ok) throw new Error("Failed to fetch free tables");
    const freeTables = await response.json();
    highlightFreeTables(freeTables);
  } catch (error) {
    console.error("Error fetching free tables:", error);
  }
}

async function fetchMenuItems() {
  try {
    const response = await fetch("http://localhost:8000/menu");
    if (!response.ok) throw new Error("Failed to fetch menu items");
    menuItems = await response.json();
    console.log("Menu Items Loaded:", menuItems);
  } catch (error) {
    console.error("Error fetching menu:", error);
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
  // Prevent duplicates
  if (selectedMenuItems.find((i) => i.item_id === item.item_id)) return;
  selectedMenuItems.push(item);
  updateSelectedItemsUI();

  // Clear search field and hide suggestions
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

    // Remove button (tag)
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
// Table Rendering & Actions
// -----------------------
function renderTables(tables) {
  const tableList = document.getElementById("tableList");
  tableList.innerHTML = "";

  tables.forEach((table) => {
    const isOccupied = !!table.occupied_time && !table.departure_time;
    const card = document.createElement("div");
    card.className =
      "bg-white rounded-lg shadow p-4 flex flex-col relative mb-4 transform hover:scale-105 transition-transform";
    card.dataset.tableId = table.table_id;

    card.innerHTML = `
      <h3 class="text-xl font-bold mb-2">Table ${table.table_id}</h3>
      <p>Status: <span class="font-semibold">${
        isOccupied ? "Occupied" : "Free"
      }</span></p>
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

function highlightFreeTables(freeTables) {
  document.querySelectorAll(".table-card, .bg-white").forEach((card) => {
    const tableId = card.dataset.tableId;
    const isFree = freeTables.some((table) => table.table_id === tableId);
    card.classList.toggle("border-4", isFree);
    card.classList.toggle("border-green-500", isFree);
  });
}

function attachTableEventListeners() {
  // Occupy table buttons
  document.querySelectorAll(".occupyBtn").forEach((button) => {
    button.addEventListener("click", () => {
      const tableId = button.dataset.tableId;
      document.getElementById(
        "occupyModalTableId"
      ).textContent = `Mark table ${tableId} as occupied?`;
      openModal("occupyModal");
      document.getElementById("occupyConfirmBtn").onclick = async () => {
        await occupyTable(tableId);
        closeModal("occupyModal");
        fetchTables();
      };
    });
  });
  // Vacate table icons
  document.querySelectorAll(".vacateIcon").forEach((icon) => {
    icon.addEventListener("click", (event) => {
      const tableId = event.target.closest("[data-table-id]").dataset.tableId;
      document.getElementById(
        "vacateModalTableId"
      ).textContent = `Vacate table ${tableId}?`;
      openModal("vacateModal");
      document.getElementById("vacateConfirmBtn").onclick = async () => {
        await vacateTable(tableId);
        closeModal("vacateModal");
        fetchTables();
      };
    });
  });
  // Order buttons
  document.querySelectorAll(".orderBtn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const tableId = event.target.dataset.tableId;
      document.getElementById("orderTableId").value = tableId;
      openModal("orderModal");
    });
  });
}

// -----------------------
// API Calls
// -----------------------
async function occupyTable(tableId) {
  try {
    const response = await fetch("http://localhost:8000/tables/occupy", {
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

async function vacateTable(tableId) {
  try {
    const response = await fetch(
      `http://localhost:8000/tables/${tableId}/leave`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to vacate table");
    }
    console.log("Table vacated successfully.");
    fetchTables();
  } catch (error) {
    console.error("Error vacating table:", error);
    alert(error.message);
  }
}

async function createOrder(tableId, items) {
  try {
    if (!Array.isArray(items)) {
      throw new Error("Items must be an array.");
    }
    const response = await fetch("http://localhost:8000/orders", {
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
