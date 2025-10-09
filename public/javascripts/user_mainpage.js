var vueinst = new Vue({
    el: '#app',
    data: {
        user_covid_status: 'Green',
        username: 'Test User',

        mode:'shops',

        provider:[],
    },
    created: function () {
        this.checkLoginStatus();
        this.getProvider();
    },
    methods: {
        checkLoginStatus(){
            var ptr = this;
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4){
                    if (this.status != 200){
                        console.log("User is NOT logged in");
                        window.location.href = '/login.html';
                    }
                    else{
                        const data = JSON.parse(xhttp.responseText);
                        if(data.success === true){
                            console.log("User is logged in");

                        }
                    }  
                }           
            };
            xhttp.open("GET", "/login/checkloginstatus.ajax", true);
            xhttp.setRequestHeader("Content-type", "application/json");
            xhttp.send();
        },
        getProvider(){
            var ptr = this;
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200){
                    console.log("Provider data loaded");
                    //解析json进入provider[]
                    ptr.provider = JSON.parse(xhttp.responseText);
                    console.log(ptr.provider);
                }
                else if(this.readyState == 4 && this.status == 401){
                    console.log("Failed to load provider data");
                }               
            };
            xhttp.open("GET", "/User_main/getProvider.ajax", true);
            xhttp.setRequestHeader("Content-type", "application/json");
            xhttp.send();
        },
        isBlocked: function (status) {
            if (status === 'Red' || status === 'Yellow') {
                return true;
            }
            else {
                return false;
            }
        },
        signout(){
            var ptr = this;
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200){
                    console.log("Sign out successful");
                    window.location.href = '/login.html';
                }
                else if(this.readyState == 4 && this.status == 401){
                    console.log("Sign out failed");
                }               
            };
            xhttp.open("GET", "/User_main/signout.ajax", true);
            xhttp.setRequestHeader("Content-type", "application/json");
            xhttp.send();
        },
        clearinput(){

        },
        login(){
            var ptr = this;
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200){
                    const data = JSON.parse(xhttp.responseText);
                    console.log("Login successful: " + data.message);
                    window.location.href = '/User_mainpage.html';
                }
                else if(this.readyState == 4 && this.status == 401){
                    const data = JSON.parse(xhttp.responseText);
                    alert("Login failed: " + data.message);
                }               
            };
            xhttp.open("POST", "/login/login.ajax", true);
            xhttp.setRequestHeader("Content-type", "application/json");
            xhttp.send(JSON.stringify({ username: this.username, password: this.password, remember: this.remember }));
        }   
    }
});
