const API_PREFIXES_LOGIN = ["/plogin", "/Plogin"];
const API_PREFIXES_PROVIDER = ["/Provider_main", "/provider_main"];

/** try each candidate URL, return JSON; only 200 is considered successful, 401 throws an explicit error */
async function tryFetchJSON(method, urlCandidates, payload) {
  let lastErr;
  for (const url of urlCandidates) {
    try {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers:
          method === "POST" ? { "Content-Type": "application/json" } : {},
        body: method === "POST" ? JSON.stringify(payload || {}) : undefined,
      });
      if (res.status === 200) return await res.json();
      if (res.status === 401) {
        const err = new Error("unauthorized");
        err.status = 401;
        err.body = await res.text().catch(() => "");
        throw err;
      }
      lastErr = new Error(`HTTP ${res.status}`);
      lastErr.status = res.status;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Network error");
}

function apiGET(path) {
  const candidates = path.includes("checkloginstatus")
    ? API_PREFIXES_LOGIN.map((p) => `${p}${path}`)
    : API_PREFIXES_PROVIDER.map((p) => `${p}${path}`);
  return tryFetchJSON("GET", candidates);
}
function apiPOST(path, payload) {
  const candidates = API_PREFIXES_PROVIDER.map((p) => `${p}${path}`);
  return tryFetchJSON("POST", candidates, payload);
}

var vueinst = new Vue({
  el: "#app",
  data: {
    // Provider info
    provider_covid_status: "Test Status",
    provider_name: "Test Provider",
    provider_id: "-1",
    provider_email: "",
    provider_type: "",
    provider_created_at: "",
    provider_description: "",
    provider_address: [],
    products: [],

    // Orders
    orders: [],
    filteredOrders: [],
    ongoingOrders: [],
    historyOrders: [],
    selectedOrder: null,
    searchQuery: "",

    // UI state
    mode: "orders", // orders(dashboard), history, order_details, profile, setting, products, covid_report

    // Editing states
    editing: {
      business_name: false,
      description: false,
      password: false,
      address: false,
    },
    form: {
      business_name: "",
      description: "",
    },
    address_form: {
      address: "",
      city: "",
      state: "",
      postcode: "",
    },
    reset_pass: {
      password: "",
      confirm_password: "",
      email_code: "",
    },

    // local sample
    sampleOrders: [],
  },

  created() {
    console.log("Vue instance created, mode:", this.mode);
    this.loadSampleOrders();
    this.bootstrap();
  },

  watch: {
    searchQuery() {
      this.filterOrders();
    },
  },

  computed: {
    emptyText() {
      return this.searchQuery
        ? "No orders match your search criteria."
        : "No orders available at the moment.";
    },
    ongoingOrdersFiltered() {
      const src = this.ongoingOrders || [];
      if (!this.searchQuery) return src;
      const q = this.searchQuery.toLowerCase();
      return src.filter(
        (o) =>
          String(o.service_id).includes(q) ||
          (o.customer_name || "").toLowerCase().includes(q) ||
          (o.order_status || "").toLowerCase().includes(q)
      );
    },
    historyOrdersFiltered() {
      const src = this.historyOrders || [];
      if (!this.searchQuery) return src;
      const q = this.searchQuery.toLowerCase();
      return src.filter(
        (o) =>
          String(o.service_id).includes(q) ||
          (o.customer_name || "").toLowerCase().includes(q) ||
          (o.order_status || "").toLowerCase().includes(q)
      );
    },
  },

  methods: {
    async bootstrap() {
      try {
        const ok = await this.checkLoginStatus();
        if (!ok) return;
        await Promise.all([
          this.getProviderInfo(),
          this.getOrders(),
          this.getProducts(),
        ]);
      } catch (e) {
        console.warn("bootstrap error:", e);
      } finally {
        console.log(
          "After initialization, mode:",
          this.mode,
          "orders:",
          this.orders.length
        );
      }
    },

    // ---------- Navigation ----------
    gohome() {
      this.mode = "orders";
      this.getOrders();
    },
    goprofile() {
      this.mode = "profile";
      this.getProviderInfo();
    },
    gosetting() {
      this.mode = "setting";
    },
    goorders() {
      this.mode = "history";
      this.getOrders();
    },
    goproducts() {
      this.mode = "products";
      this.getProducts();
    },
    gocovid_status() {
      this.mode = "covid_report";
      this.getProviderInfo();
    },

    // ---------- Sample Orders ----------
    loadSampleOrders() {
      console.log("Loading sample orders...");
      this.sampleOrders = [
        {
          service_id: 1001,
          customer_name: "Alice Johnson",
          customer_email: "alice@example.com",
          order_timestamp: new Date().toISOString(),
          order_status: "ongoing",
          order_covid_status: "Green",
          amount: 45.5,
          pickup_address: "101 Orchard Rd, Adelaide, SA, 5000",
          dropoff_address: "12 King St, Adelaide, SA, 5000",
          customer_covid_status: "Green",
          items: [
            { product_name: "Apple", price: 19.99, quantity: 2 },
            { product_name: "Banana", price: 9.99, quantity: 1 },
          ],
        },
        {
          service_id: 1002,
          customer_name: "Bob Smith",
          customer_email: "bob@example.com",
          order_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          order_status: "ongoing",
          order_covid_status: "Yellow",
          amount: 28.75,
          pickup_address: "101 Orchard Rd, Adelaide, SA, 5000",
          dropoff_address: "456 Market Rd, Adelaide, SA, 5000",
          customer_covid_status: "Yellow",
          items: [
            { product_name: "Cherry", price: 14.99, quantity: 1 },
            { product_name: "Lemon", price: 99.99, quantity: 1 },
          ],
        },
        {
          service_id: 1003,
          customer_name: "Charlie Brown",
          customer_email: "charlie@example.com",
          order_timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          order_status: "ongoing",
          order_covid_status: "Red",
          amount: 67.2,
          pickup_address: "101 Orchard Rd, Adelaide, SA, 5000",
          dropoff_address: "78 River Ave, Adelaide, SA, 5000",
          customer_covid_status: "Red",
          items: [
            { product_name: "Apple", price: 19.99, quantity: 3 },
            { product_name: "Banana", price: 9.99, quantity: 2 },
          ],
        },
        {
          service_id: 1004,
          customer_name: "Diana Prince",
          customer_email: "diana@example.com",
          order_timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          order_status: "ongoing",
          order_covid_status: "Green",
          amount: 35.4,
          pickup_address: "101 Orchard Rd, Adelaide, SA, 5000",
          dropoff_address: "99 Ocean Dr, Adelaide, SA, 5000",
          customer_covid_status: "Green",
          items: [
            { product_name: "Banana", price: 9.99, quantity: 2 },
            { product_name: "Cherry", price: 14.99, quantity: 1 },
          ],
        },
        {
          service_id: 1005,
          customer_name: "Eve Wilson",
          customer_email: "eve@example.com",
          order_timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          order_status: "finished",
          order_covid_status: "Green",
          amount: 52.8,
          pickup_address: "101 Orchard Rd, Adelaide, SA, 5000",
          dropoff_address: "123 Garden St, Adelaide, SA, 5000",
          customer_covid_status: "Green",
          items: [
            { product_name: "Apple", price: 19.99, quantity: 1 },
            { product_name: "Lemon", price: 99.99, quantity: 1 },
          ],
        },
      ];
      this.orders = this.sampleOrders;
      this.filteredOrders = this.sampleOrders;
      console.log("Sample orders loaded:", this.orders.length, "orders");
    },

    // ---------- Orders ----------
    async getOrders() {
      try {
        const data = await apiGET("/getOrders.ajax");
        this.orders = Array.isArray(data.orders) ? data.orders : [];
        this.ongoingOrders = this.orders.filter(
          (o) => o.order_status === "ongoing"
        );
        this.historyOrders = this.orders.filter(
          (o) => o.order_status === "finished"
        );
        this.filteredOrders = this.orders;
        console.log("Orders loaded:", this.orders.length);
      } catch (e) {
        console.warn(
          "getOrders failed, using sampleOrders. Reason:",
          e && e.status
        );
        this.orders = this.sampleOrders;
        this.ongoingOrders = this.sampleOrders.filter(
          (o) => o.order_status === "ongoing"
        );
        this.historyOrders = this.sampleOrders.filter(
          (o) => o.order_status === "finished"
        );
        this.filteredOrders = this.sampleOrders;
      }
    },

    refreshOrders() {
      this.getOrders();
    },

    filterOrders() {
      if (!this.searchQuery) {
        this.filteredOrders = this.orders;
        return;
      }
      const q = this.searchQuery.toLowerCase();
      this.filteredOrders = this.orders.filter((o) => {
        return (
          String(o.service_id).includes(q) ||
          (o.customer_name || "").toLowerCase().includes(q) ||
          (o.order_status || "").toLowerCase().includes(q)
        );
      });
    },

    async updateOrderStatus(serviceId, currentStatus) {
      if (currentStatus !== "ongoing") return;
      try {
        const data = await apiPOST("/updateOrderStatus.ajax", {
          service_id: serviceId,
          order_status: "finished",
        });
        alert("Order status updated successfully: " + (data && data.message));
        await this.getOrders();
      } catch (e) {
        alert("Failed to update order status");
        console.error("updateOrderStatus error:", e);
      }
    },

    viewOrderDetails(order) {
      this.selectedOrder = order || null;
      if (!this.selectedOrder) return;
      if (!Array.isArray(this.selectedOrder.items)) {
        this.selectedOrder.items = this.selectedOrder.items || [];
      }
      this.mode = "order_details";
    },

    getOrderStatusClass(status) {
      switch (status) {
        case "ongoing":
          return "Yellow";
        case "finished":
          return "Green";
        default:
          return "Yellow";
      }
    },
    getButtonClass(status) {
      switch (status) {
        case "ongoing":
          return "btn-accept";
        case "finished":
          return "btn-completed";
        default:
          return "btn-accept";
      }
    },
    getButtonText(status) {
      switch (status) {
        case "ongoing":
          return "Mark as Completed";
        case "finished":
          return "Completed";
        default:
          return "Mark as Completed";
      }
    },

    // ---------- Products ----------
    async getProducts() {
      try {
        const data = await apiGET("/getProducts.ajax");
        this.products = Array.isArray(data.products) ? data.products : [];
        console.log("Products loaded:", this.products.length);
      } catch (e) {
        console.warn("getProducts failed:", e && e.status);
      }
    },

    async toggleProductStatus(productId, currentStatus) {
      const next = currentStatus === "available" ? "out_of_stock" : "available";
      try {
        const data = await apiPOST("/updateProductStatus.ajax", {
          product_id: productId,
          status: next,
        });
        alert("Product status updated successfully: " + (data && data.message));
        await this.getProducts();
      } catch (e) {
        alert("Failed to update product status");
        console.error("toggleProductStatus error:", e);
      }
    },

    editProduct() {
      alert("Product editing feature will be implemented soon.");
    },

    // ---------- Profile ----------
    async getProviderInfo() {
      try {
        const data = await apiGET("/getProviderInfo.ajax");
        if (data && data.provider) {
          this.provider_created_at = data.provider.created_at;
          this.provider_address = data.address || [];
          this.provider_name = data.provider.name;
          this.provider_description = data.provider.description;
          this.provider_type = data.provider.user_type;
          this.provider_email = data.provider.email;
          console.log("Provider data loaded");
        }
        await this.checkProviderCovidStatus();
      } catch (e) {
        console.warn("getProviderInfo failed:", e && e.status);
      }
    },

    async checkProviderCovidStatus() {
      try {
        const data = await apiGET("/checkProviderCovidStatus");
        if (data && data.provider) {
          this.provider_covid_status = data.provider.covid_status;
          console.log("Provider covid status:", data.provider.covid_status);
        }
      } catch (e) {
        console.warn("checkProviderCovidStatus failed:", e && e.status);
      }
    },

    toggleEdit(field) {
      this.editing[field] = !this.editing[field];
      if (field === "business_name") {
        this.form.business_name = this.provider_name;
      } else if (field === "description") {
        this.form.description = this.provider_description;
      } else if (field === "address") {
        this.address_form = {
          address: "",
          city: "",
          state: "",
          postcode: "",
        };
      }
    },

    async business_name_change() {
      const { business_name } = this.form;
      if (!business_name) return alert("Business name cannot be empty.");
      try {
        const data = await apiPOST("/business_name_change", { business_name });
        console.log("Update successful:", data && data.message);
        this.editing.business_name = false;
        this.provider_name = business_name;
        await this.getProviderInfo();
      } catch (e) {
        alert("Failed to update business name");
      }
    },

    async add_address() {
      const { address, city, state, postcode } = this.address_form;
      if (!address || !city || !state || !postcode) {
        alert("All address fields are required.");
        return;
      }
      try {
        const data = await apiPOST("/add_address", {
          address,
          city,
          state,
          postcode,
        });
        console.log("Address added:", data && data.message);
        this.editing.address = false;
        this.address_form = { address: "", city: "", state: "", postcode: "" };
        await this.getProviderInfo();
      } catch (e) {
        console.warn("add_address failed:", e && e.status);
        alert("Failed to add address. Please try again.");
      }
    },

    async description_change() {
      const { description } = this.form;
      if (!description) return alert("Description cannot be empty.");
      try {
        const data = await apiPOST("/description_change", { description });
        console.log("Update successful:", data && data.message);
        this.editing.description = false;
        this.provider_description = description;
        await this.getProviderInfo();
      } catch (e) {
        alert("Failed to update description");
      }
    },

    async getemailcode() {
      if (!this.provider_email)
        return alert("Email is empty, cannot send code.");
      try {
        const data = await apiGET("/getemailcode");
        if (data && data.success === true) {
          alert("Verification code sent to your email.");
        } else {
          alert("Failed to send verification code: " + (data && data.message));
        }
      } catch (e) {
        alert("Failed to send verification code");
      }
    },

    async password_change() {
      if (
        !this.reset_pass.password ||
        !this.reset_pass.confirm_password ||
        !this.reset_pass.email_code
      ) {
        return alert("All fields are required.");
      }
      if (this.reset_pass.password !== this.reset_pass.confirm_password) {
        return alert("Passwords do not match.");
      }
      try {
        const data = await apiPOST("/password_change", {
          email_code: this.reset_pass.email_code,
          password: this.reset_pass.password,
        });
        console.log("Password reset successful:", data && data.message);
        this.reset_pass = {
          email_code: "",
          password: "",
          confirm_password: "",
        };
        this.editing.password = false;
        alert("Password changed successfully.");
      } catch (e) {
        alert("Failed to change password");
      }
    },

    // ---------- Covid status ----------
    async reportCovid(status) {
      if (!["Red", "Yellow", "Green"].includes(status)) {
        return alert("Invalid status.");
      }
      try {
        // 1) update provider covid status
        const data = await apiPOST("/report_covid", { state_name: status });
        console.log("Covid status report successful:", data && data.message);

        // 2) if provider reported Red/Yellow, downgrade related customers to Yellow and update orders' covid to provider's state
        if (status === "Red" || status === "Yellow") {
          try {
            const result = await this.change_relevant_covid(status);
            if (
              result &&
              result.affected_customers &&
              result.affected_customers.length > 0
            ) {
              const names = result.affected_customers
                .map((c) => c.name)
                .join(", ");
              if (status === "Red") {
                alert(
                  "Affected customers set to Yellow; related orders marked Red: " +
                    names
                );
              } else {
                alert(
                  "Affected customers set to Yellow; related orders marked Yellow: " +
                    names
                );
              }
            } else {
              alert("No ongoing customers to update.");
            }
          } catch (e) {
            console.warn("change_relevant_covid error", e);
          }
        }

        // 3) refresh provider info & orders
        await Promise.all([this.getProviderInfo(), this.getOrders()]);

        alert("Covid status updated to " + status);
      } catch (e) {
        alert("Failed to report covid status");
        console.error(e);
      }
    },

    /** update relevant orders' covid status */
    async change_relevant_covid(state) {
      const data = await apiGET(
        `/change_relevant_covid?state=${encodeURIComponent(state || "Red")}`
      );
      console.log(
        "Relevant orders' covid status updated:",
        data && data.message
      );
      return data;
    },

    // ---------- Utils ----------
    formatOrderTime(ts) {
      const d = new Date(ts);
      return new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Adelaide",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(d);
    },

    async checkLoginStatus() {
      try {
        const data = await tryFetchJSON(
          "GET",
          API_PREFIXES_LOGIN.map((p) => `${p}/checkloginstatus.ajax`)
        );
        if (data && data.success === true) {
          console.log("Provider is logged in");
          this.provider_name = data.provider.name;
          this.provider_covid_status = data.provider.covid_status;
          this.provider_id = data.provider.id;
          this.provider_email = data.provider.email;
          this.provider_type = data.provider.user_type;
          return true;
        }
        window.location.href = "/provider_login.html";
        return false;
      } catch (e) {
        console.log("Provider is NOT logged in");
        window.location.href = "/provider_login.html";
        return false;
      }
    },

    async signout() {
      try {
        await apiGET("/signout.ajax");
        console.log("Sign out successful");
        window.location.href = "/provider_login.html";
      } catch (e) {
        console.log("Sign out failed");
      }
    },
  },
});
