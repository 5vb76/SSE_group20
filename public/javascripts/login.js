var vueinst = new Vue({
  el: "#forms",
  data: {
    mode: "login",
    username: "",
    password: "",
    reset_send: false,
    hint: "Enter your email and password to log in.",
    resetEmail: "",
    resetCode: "",
    remember: false,
    new_password: "",
    confirm_password: "",
  },
  created: function () {
    this.checkLoginStatus();
  },
  methods: {
    checkLoginStatus() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          if (data.success === true) {
            console.log("User is logged in");
            window.location.href = "/User_mainpage.html";
          }
        }
      };
      xhttp.open("GET", "/login/checkloginstatus.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send();
    },
    clearinput() {
      this.username = "";
      this.password = "";
      this.resetEmail = "";
      this.resetCode = "";
      this.new_password = "";
      this.confirm_password = "";
      this.reset_send = false;
    },
    switch() {
      this.mode = "login";
    },
    login() {
      var ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.status == 429) {
          alert("Too many login attempts. Please try again later.");
          return;
        }
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          console.log("Login successful: " + data.message);
          window.location.href = "/User_mainpage.html";
        } else {
          const data = JSON.parse(xhttp.responseText);
          console.log(xhttp.responseText);
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
    show() {
      const input = document.getElementById("password");
      if (input.type === "password") {
        input.type = "text";
      } else {
        input.type = "password";
      }
    },
    switchToForget() {
      this.mode = "forget";
      this.hint = "Enter your email to receive reset link.";
      this.clearinput();
    },
    switchToLogin() {
      this.mode = "login";
      this.hint = "Eenter your email and password to log in.";
      this.clearinput();
    },
    goToSignup() {
      window.location.href = "/signup.html";
    },
    sendReset() {
      const ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(xhttp.responseText);
          ptr.reset_send = true;
          ptr.hint = "Please Enter Reset Code within 15 mins.";
          console.log("send code!");
        } else if (this.readyState == 4 && this.status == 401) {
          const data = JSON.parse(xhttp.responseText);
          alert("No such Account, Please try again");
        }
      };
      xhttp.open("POST", "/login/forget.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({ username: this.resetEmail }));
    },
    ChangetoReset() {
      const ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          ptr.hint = "Enter new Password";
          ptr.mode = "ChangePass";
          console.log("Ready to Reset!");
        } else if (this.readyState == 4 && this.status == 401) {
          alert("Wrong Code, Please try again");
        } else if (this.readyState == 4 && this.status == 402) {
          alert("Timeout, Please try again");
        } else if (this.readyState == 4 && this.status == 403) {
          alert("ResetCode cannot be empty");
        }
      };
      xhttp.open("POST", "/login/varify_forget.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({ username: this.resetEmail, resetCode: this.resetCode })
      );
    },
    ChangePassword() {
      if (this.new_password !== this.confirm_password) {
        alert("Passwords do not match!");
        return;
      }
      const ptr = this;
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          alert("Password Changed Successfully!");
          ptr.mode = "login";
          console.log("Done!");
        }
      };
      xhttp.open("POST", "/login/ChangePass.ajax", true);
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(
        JSON.stringify({
          email: this.resetEmail,
          new_password: this.new_password,
        })
      );
    },
  },
});
