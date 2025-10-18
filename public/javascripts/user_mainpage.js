var vueinst = new Vue({
  el: "#app",
  data: {
    user_covid_status: "Test Status",
    username: "Test User",
    user_id: "-1",
    user_email: "",
    user_type: "",
    user_created_at: "",
    user_address: [],
    user_history: [],
    grouped_user_history: [],

    mode: "shops", // shops, profile
    cart_checkout: false,
    payment_method: "",
    delivery_address: "",

    // cart
    provider: [],
    provider_search: [],
    focused_provider: -1,

    editing: {
      username: false,
      address_id: false,
      password: false,
      add_addr: false,
    },
    form: {
      user_id: "",
      username: "",
      address_id: "",
      address: "",
      city: "",
      state: "",
      postcode: "",
      password: "",
    },
    reset_pass: { password: "", confirm_password: "", email_code: "" },
    add_addr: { address: "", city: "", state: "", postcode: "" },

    search_query: "",
  },
  created: function () {
    this.checkLoginStatus();
    this.getProvider();
    this.getUserInfo();
    this.get_user_history();
    this.form.user_id = this.user_id;
  },
  methods: {
    toggleEdit: function (field, value) {
      this.editing[field] = !this.editing[field];
      if (field === "username") {
        this.form.username = this.username;
        return;
      } else if (field === "address_id") {
        this.form.address_id = value;
        console.log(this.editing[field]);
        console.log(this.form.address_id);
      }
    },
    viewProvider(provider_id) {
      var ptr = this;
      for (var i = 0; i < this.provider.length; i++) {
        if (this.provider[i].id === provider_id) {
          ptr.focused_provider = this.provider[i];
          break;
        }
      }
      this.mode = "cart";
    },
    username_change() {
      var ptr = this;
      const { username } = this.form;
      if (!username) {
        alert("Username cannot be empty.");
        return;
      }
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Update successful: " + data.message);
          ptr.editing.username = false;
          ptr.username = username;
          ptr.getUserInfo();
        }
      };
      xhttp.open("POST", "/User_main/username_change", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({ username }));
    },
    email_change() {
      var ptr = this;
      const { address_id, address, city, state, postcode } = this.form;
      if (!address || !city || !state || !postcode) {
        alert("All address fields are required.");
        return;
      }
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Update successful: " + data.message);
          ptr.editing.address_id = false;
          ptr.getUserInfo();
        }
      };
      xhttp.open("POST", "/User_main/email_change", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({ address_id, address, city, state, postcode })
      );
    },
    add_address() {
      var ptr = this;
      const { address, city, state, postcode } = this.add_addr;
      if (!address || !city || !state || !postcode) {
        alert("All address fields are required.");
        return;
      }
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Add address successful: " + data.message);
          ptr.editing.add_addr = false;
          ptr.add_addr = { address: "", city: "", state: "", postcode: "" };
          ptr.getUserInfo();
        }
      };
      xhttp.open("POST", "/User_main/add_address", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({ address, city, state, postcode }));
    },
    delete_address(address_id) {
      var ptr = this;
      if (!address_id) {
        alert("Address ID is missing.");
        return;
      }
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Delete address successful: " + data.message);
          ptr.getUserInfo();
        }
      };
      xhttp.open("POST", "/User_main/delete_address", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({ address_id }));
    },
    getemailcode() {
      var ptr = this;
      if (!ptr.user_email) {
        alert("Email is empty, cannot send code.");
        return;
      }
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          if (data.success === true) {
            alert("Verification code sent to your email.");
          } else {
            alert("Failed to send verification code: " + data.message);
          }
        }
      };
      xhttp.open("GET", "/User_main/getemailcode", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    password_change() {
      var ptr = this;
      if (
        !ptr.reset_pass.password ||
        !ptr.reset_pass.confirm_password ||
        !ptr.reset_pass.email_code
      ) {
        alert("All fields are required.");
        return;
      }
      if (ptr.reset_pass.password !== ptr.reset_pass.confirm_password) {
        alert("Passwords do not match.");
        return;
      }
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Password reset successful: " + data.message);
          ptr.reset_pass = {
            email_code: "",
            password: "",
            confirm_password: "",
          };
          ptr.editing.password = false;
          alert("Password changed successfully.");
        }
      };
      xhttp.open("POST", "/User_main/password_change", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({
          email_code: ptr.reset_pass.email_code,
          password: ptr.reset_pass.password,
        })
      );
    },
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
    gocovid_status() {
      this.mode = "covid_report";
      this.getUserInfo();
    },
    search(){
        var ptr = this;
        if(!this.search_query){
            alert("Search query cannot be empty.");
            return;
        }
        ptr.provider_search = ptr.provider.map(function (prov) {
            let found = false;
            if (prov.items && Array.isArray(prov.items)) {
                found = prov.items.some(function (item) {
                    return (
                        typeof item.name === "string" &&
                        item.name.toLowerCase().includes(ptr.search_query.toLowerCase())
                    );
                });
            }
            return { ...prov, found };
        });
        console.log(ptr.provider_search);
    },
    gohome() {
      this.mode = "shops";
      this.getProvider();
      this.getUserInfo();
    },
    goprofile() {
      this.mode = "profile";
      this.getUserInfo();
    },
    gosetting() {
      this.mode = "setting";
    },
    gohistory() {
      this.mode = "history";
      this.get_user_history();
    },
    gosearch(){
        this.mode = "search";
        this.search();
    },
    check_usercovid_status() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          ptr.user_covid_status = data.user.covid_status;
          console.log("User covid status checked: " + data.user.covid_status);
        }
      };
      xhttp.open("GET", "/User_main/check_user_covid_status", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    reportCovid(status) {
      var ptr = this;
      if (status !== "Red" && status !== "Yellow" && status !== "Green") {
        alert("Invalid status.");
        return;
      }
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Covid status report successful: " + data.message);
          ptr.getUserInfo();
          //algorithm: change all relevant orders' covid status to the reported status and provider status as yellow.
          ptr.change_relevant_covid();
          alert("Covid status updated to " + status);
        }
      };
      xhttp.open("POST", "/User_main/report_covid", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({ state_name: status }));
    },
    //algorithm: change all relevant orders' covid status to the reported status and provider status as yellow.
    change_relevant_covid() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Relevant orders' covid status updated: " + data.message);
          /*var names = (data.affected_providers || [])
            .map(function (p) {
              return p.name;
            })
            .join(", ");
          if (names) {
            alert(
              "Providers set to Yellow due to user reporting Red: " + names
            );
          } else {
            alert("User reported Red; no ongoing providers to update.");
          }*/
        }
      };
      xhttp.open("GET", "/User_main/change_relevant_covid", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    group_up_user_history() {
      var groups = {};
      this.user_history.forEach(function (o) {
        var sid = o.service_id;
        if (!groups[sid]) {
          groups[sid] = {
            service_id: sid,
            provider_id: o.provider_id,
            provider_name: o.provider_name,
            provider_email: o.provider_email,
            provider_description: o.provider_description,
            covid_status: o.covid_status,
            pickup_address: o.pickup_address,
            dropoff_address: o.dropoff_address,
            payment_id: o.payment_id,
            payment_method: o.payment_method,
            payment_status: o.payment_status,
            order_status: o.order_status,
            order_covid_status: o.order_covid_status,
            order_timestamp: o.order_timestamp,
            amount: o.amount,
            // items
            items: [],
          };
        }
        groups[sid].items.push({
          product_id: o.product_id,
          product_name: o.product_name,
          product_status: o.product_status,
          price: o.price,
          quantity: o.quantity,
        });
      });
      // reverse grouped_user_history to have latest orders first order by service_id.
      this.grouped_user_history = Object.values(groups || {}).sort(
        (a, b) => Number(b.service_id) - Number(a.service_id)
      );
      console.log(this.grouped_user_history);
    },
    get_user_history() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          ptr.user_history = data.history;
          //console.log(ptr.user_history);
          ptr.group_up_user_history();
        } else if (this.readyState == 4 && this.status == 401) {
          console.log("Failed to load user history");
        }
      };
      xhttp.open("GET", "/User_main/get_user_history", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    checkLoginStatus() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4) {
          if (this.status != 200) {
            console.log("User is NOT logged in");
            window.location.href = "/login.html";
          } else {
            const data = JSON.parse(xhttp.responseText);
            if (data.success === true) {
              console.log("User is logged in");
              ptr.username = data.user.name;
              ptr.user_covid_status = data.user.covid_status;
              ptr.user_id = data.user.id;
              ptr.user_email = data.user.email;
              ptr.user_type = data.user.user_type;
            }
          }
        }
      };
      xhttp.open("GET", "/login/checkloginstatus.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    reportOrder(service_id) {
      alert("Report function is not implemented yet.");
    },
    // Determine if item is out of stock
    isOOS(item) {
      return String(item.status).toLowerCase() === "out_of_stock";
    },
    getTotalPrice() {
      var total = 0;
      for (var i = 0; i < this.focused_provider.items.length; i++) {
        var item = this.focused_provider.items[i];
        if (!this.isOOS(item) && item.qty) {
          total += Number(item.price) * item.qty;
        }
      }
      return total.toFixed(2);
    },
    prepare_checkout() {
      this.cart_checkout = true;
    },
    checkout() {
      var ptr = this;
      var cart = this.focused_provider.items.filter(function (item) {
        return (
          String(item.status).toLowerCase() !== "out_of_stock" &&
          item.qty &&
          item.qty > 0
        );
      });
      console.log(cart);
      if (!this.payment_method) {
        alert("Please select a payment method.");
        return;
      }
      if (!this.delivery_address) {
        alert("Please select a delivery address.");
        return;
      }
      var dropoff_address_id = this.user_address.find(
        (addr) => addr.id === this.delivery_address
      );
      var dropoff_address = dropoff_address_id.address + ", " + dropoff_address_id.city + ", " + dropoff_address_id.state + ", " + dropoff_address_id.postcode;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          alert("Checkout successful!, address: " + dropoff_address);
          ptr.cart_checkout = false;
          ptr.mode = "shops";
          ptr.focused_provider = -1;
          ptr.get_user_history();
        }
      };
      xhttp.open("POST", "/User_main/checkout", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({
          payment_method: this.payment_method,
          dropoff_address: dropoff_address,
          cart: cart,
          provider_id: this.focused_provider.id,
          amount: this.getTotalPrice(),
          user_id: this.user_id,
        })
      );
    },
    getUserInfo() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          ptr.user_created_at = data.user.created_at;
          ptr.user_address = data.address;
          ptr.username = data.user.name;
          ptr.check_usercovid_status();
          ptr.user_type = data.user.user_type;
          ptr.user_email = data.user.email;
          console.log("User data loaded");
          console.log(ptr.user_address);
        } else if (this.readyState == 4 && this.status == 401) {
          console.log("Failed to load user data");
        }
      };
      xhttp.open("GET", "/User_main/getuserinfo.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    getProvider() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          console.log("Provider data loaded");
          //解析json进入provider[]
          ptr.provider = JSON.parse(xhttp.responseText);
          console.log(ptr.provider);
        } else if (this.readyState == 4 && this.status == 401) {
          console.log("Failed to load provider data");
        }
      };
      xhttp.open("GET", "/User_main/getProvider.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    isBlocked: function (status) {
      if (status === "Red" || status === "Yellow") {
        return true;
      } else if (
        this.user_covid_status === "Red" ||
        this.user_covid_status === "Yellow"
      ) {
        return true;
      }
      return false;
    },
    signout() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          console.log("Sign out successful");
          window.location.href = "/login.html";
        } else if (this.readyState == 4 && this.status == 401) {
          console.log("Sign out failed");
        }
      };
      xhttp.open("GET", "/User_main/signout.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
  },
});
