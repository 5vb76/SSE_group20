var vueinst = new Vue({
  el: "#forms",
  data: {
    mode: "whosignup",
    //Customer: user data:
    user_name: "",
    user_email: "",
    user_password: "",
    user_confirm_password: "",
    varifyEmailCode: "",
    //Provider: provider data:
    provider_name: "",
    provider_email: "",
    provider_password: "",
    provider_confirm_password: "",
    provider_address: "",
    provider_varifyEmailCode: "",

    provider_address: "",
    provider_city: "",
    provider_state: "",
    provider_postcode: "",
  },
  methods: {
    clearinput() {},
    switchCsignup() {
      this.mode = "customer";
    },
    switchPsignup() {
      this.mode = "provider";
    },
    show() {
      const input = document.getElementById("password");
      if (input.type === "password") {
        input.type = "text";
      } else {
        input.type = "password";
      }
    },
    cshow() {
      const input = document.getElementById("confirm_password");
      if (input.type === "password") {
        input.type = "text";
      } else {
        input.type = "password";
      }
    },
    switchToSignup() {
      this.mode = "whosignup";
      this.clearinput();
    },
    c_email_varify() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          alert("Send successful: " + data.message);
        } else if (this.readyState == 4 && this.status == 401) {
          const data = JSON.parse(xhttp.responseText);
          alert("Send fail " + data.message);
        }
      };
      xhttp.open("POST", "/signup/c_email_varify.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({ user_email: this.user_email }));
    },
    Cregister() {
      if (this.user_password !== this.user_confirm_password) {
        alert("Two passwords do not match!");
        return;
      }
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          alert("registed successful: " + data.message);
          window.location.href = "/login.html";
        } else if (this.readyState == 4 && this.status == 401) {
          const data = JSON.parse(xhttp.responseText);
          alert("registed fail " + data.message);
        }
      };
      xhttp.open("POST", "/signup/Cregister.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({
          user_name: this.user_name,
          user_email: this.user_email,
          user_password: this.user_password,
          varifyEmailCode: this.varifyEmailCode,
        })
      );
    },
    p_email_varify() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          alert("Send successful: " + data.message);
        } else if (this.readyState == 4 && this.status == 401) {
          const data = JSON.parse(xhttp.responseText);
          alert("Send fail " + data.message);
        }
      };
      xhttp.open("POST", "/signup/p_email_varify.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({ email: this.provider_email }));
    },
    Pregister() {
      if (this.provider_password !== this.provider_confirm_password) {
        alert("Two passwords do not match!");
        return;
      }
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          alert("registed successful: " + data.message);
          ptr.mode = "whosignup";
          window.location.href = "/provider_login.html";
        } else if (this.readyState == 4 && this.status == 401) {
          const data = JSON.parse(xhttp.responseText);
          alert("registed fail " + data.message);
        }
      };
      xhttp.open("POST", "/signup/Pregister.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({
          provider_name: this.provider_name,
          provider_email: this.provider_email,
          provider_password: this.provider_password,
          provider_address: this.provider_address,
          provider_varifyEmailCode: this.provider_varifyEmailCode,
          provider_address: this.provider_address,
          provider_city: this.provider_city,
          provider_state: this.provider_state,
          provider_postcode: this.provider_postcode,
        })
      );
    },

    login() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          alert("Login successful: " + data.message);
        } else if (this.readyState == 4 && this.status == 401) {
          const data = JSON.parse(xhttp.responseText);
          alert("Login failed: " + data.message);
        }
      };
      xhttp.open("POST", "/login/login.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({
          username: this.username,
          password: this.password,
          remember: this.remember,
        })
      );
    },
  },
});
