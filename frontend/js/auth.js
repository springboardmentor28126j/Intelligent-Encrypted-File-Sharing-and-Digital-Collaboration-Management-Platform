// TrustShare Authentication

const registerForm = document.getElementById("registerForm");


// -----------------------------
// Register User
// -----------------------------

if (registerForm) {

    registerForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const name =
            document.getElementById("name").value;

        const email =
            document.getElementById("email").value;

        const password =
            document.getElementById("password").value;


        try {

            const response = await fetch(
                "http://127.0.0.1:8000/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        name: name,
                        email: email,
                        password: password
                    })
                }
            );


            const result = await response.json();


            if (response.ok) {

                alert("Registration successful!");

                registerForm.reset();

                window.location.href =
                    "login.html";

            } else {

                alert(
                    result.detail ||
                    "Registration failed."
                );

            }

        } catch (error) {

            console.error(error);

            alert(
                "Could not connect to the TrustShare server."
            );

        }

    });

}
// -----------------------------
// Login User
// -----------------------------

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        // Prevent normal form submission
        event.preventDefault();

        const email =
                 document.getElementById("loginEmail").value;

        const password =
                 document.getElementById("loginPassword").value;
        try {

            const response = await fetch(
                "http://127.0.0.1:8000/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );

            const result = await response.json();

            // Only open dashboard if login is successful
            if (
                response.ok &&
                result.message === "Login successful"
            ) {

                alert("Login successful!");

                // Save logged-in user
                localStorage.setItem(
                    "user",
                    JSON.stringify(result.user)
                );

                localStorage.setItem(
                    "access_token",
                    result.access_token
                );

                // Redirect to dashboard
                window.location.href = "dashboard.html";

            } else {

                alert(
                    result.message ||
                    "Invalid email or password."
                );

            }

        } catch (error) {

            console.error(error);

            alert(
                "Could not connect to the TrustShare server."
            );

        }

    });

}