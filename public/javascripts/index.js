// Index page navigation handlers
document.addEventListener("DOMContentLoaded", function () {
  // User login button
  const userLoginBtn = document.getElementById("user-login-btn");
  if (userLoginBtn) {
    userLoginBtn.addEventListener("click", function () {
      window.location.href = "/login.html";
    });
  }

  // Provider login button
  const providerLoginBtn = document.getElementById("provider-login-btn");
  if (providerLoginBtn) {
    providerLoginBtn.addEventListener("click", function () {
      window.location.href = "/provider_login.html";
    });
  }

  // Signup button
  const signupBtn = document.getElementById("signup-btn");
  if (signupBtn) {
    signupBtn.addEventListener("click", function () {
      window.location.href = "/signup.html";
    });
  }
});
