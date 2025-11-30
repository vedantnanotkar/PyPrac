// This script runs on the profile page
(function () {
  // 1. Get DOM elements
  const userNameEl = document.getElementById("user-name");
  const logoutButton = document.getElementById("logout-button");

  // 2. Check for the saved user in localStorage
  const savedUserString = localStorage.getItem("studentUser");

  if (!savedUserString) {
    // 3. IF NO USER, redirect to login page immediately
    window.location.href = "/PyPrac/login.html";
    return; // Stop running the script
  }

  // 4. IF USER EXISTS, parse the data and show it
  try {
    const userData = JSON.parse(savedUserString);
    userNameEl.textContent = userData.firstName || "Student";
  } catch (e) {
    // If data is corrupt, log out and redirect
    console.error("Error parsing user data:", e);
    localStorage.removeItem("studentUser");
    window.location.href = "/PyPrac/login.html";
  }

  // 5. Make the logout button work on this page too
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("studentUser");
    window.location.href = "/PyPrac/login.html";
  });
})();


// This Script for Svg data changing
document.addEventListener("DOMContentLoaded", function () {

    // Read main object
    const raw = localStorage.getItem("studentUser");
    if (!raw) {
        console.warn("studentUser not found in localStorage");
        return;
    }

    let student;
    try {
        student = JSON.parse(raw);
    } catch (e) {
        console.error("Invalid studentUser JSON");
        return;
    }

    // Build full name
    const fullName = [
        student.firstName || "",
        student.middleName || "",
        student.lastName || ""
    ].filter(Boolean).join(" ");

    // Extract other fields
    const classSec = student.section || "";
    const classRoll = student.rollNumber || student.rollNum || "";
    const stuEmail = student.email || "";

    // Store into unique localStorage keys
    localStorage.setItem("fullName", fullName);
    localStorage.setItem("classSec", classSec);
    localStorage.setItem("classRoll", classRoll);
    localStorage.setItem("stuEmail", stuEmail);

    console.log("Stored:", {
        fullName,
        classSec,
        classRoll,
        stuEmail
    });

    document.getElementById("fullName").textContent = localStorage.fullName;
    document.getElementById("classSec").textContent = localStorage.classSec;
    document.getElementById("classRoll").textContent = localStorage.classRoll;
    document.getElementById("email").textContent = localStorage.stuEmail;
});