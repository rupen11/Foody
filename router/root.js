const express = require("express");
const bcryptjs = require("bcrypt");
const multer = require("multer");
const otpGenerator = require("otp-generator");
const https = require('https');
const PaytmChecksum = require('paytmchecksum');
const router = express.Router();

const Customer = require("../models/Customer");
const Address = require("../models/Address");
const Order = require("../models/Order");
const Food = require("../models/Food");
const Review = require("../models/Review");
const Owner = require("../models/Owner");
const Otp = require("../models/Otp");
const Forgot = require("../models/Forgot");
const auth = require("../middleware/auth");
const pincodes = require("../pincodes.json");


const DIR = './public/';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, DIR);
    },
    filename: function (req, file, cb) {
        const fileName = file.originalname.split(".");
        cb(null, fileName[0] + Date.now() + Math.floor(Math.random(10)) + "." + fileName[1]);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/png" || file.mimetype === "image/jpg" || file.mimetype === "image/jpeg") {
            cb(null, true);
        } else {
            cb(null, false);
            return res.status(400).json({ error: 'Only .png, .jpg and .jpeg format allowed!' });
        }
    }
});








// Get current user details
router.get("/user", auth, async (req, res) => {
    const user = await Customer.findOne({ _id: req.userId });
    if (!user) return res.status(400).json("We can not get user data");
    return res.status(200).json(user);
});

// Get current restaurant owner details
router.get("/owner", auth, async (req, res) => {
    const user = await Owner.findOne({ _id: req.userId });
    if (!user) return res.status(400).json("We can not get owner data");
    return res.status(200).json(user);
});

// Post requests
// Signup Customer
router.post("/signup/:usertype", async (req, res) => {
    const usertype = req.params.usertype;
    try {
        if (usertype === 'customer') {
            const { firstname, lastname, phone, email, password, confirmpassword } = req.body;

            // Check password and cofirm password are same or not
            if (password !== confirmpassword) {
                return res.status(400).json({ error: "Password not Match with Confirm Password, Check it!" });
            }

            const findData = await Customer.findOne({ email });
            if (findData) {
                return res.status(400).json({ error: "This Email Address is already in used" });
            }

            const hashpass = await bcryptjs.hash(password, 10);

            const registerCustomer = new Customer({ firstname, lastname, phone, email, password: hashpass, usertype });

            // Generate token
            const token = await registerCustomer.generateAuthToken();

            const registerSuccess = await registerCustomer.save();
            if (!registerSuccess) {
                return res.status(400).json({ error: "Some error getting to create user account" });
            }
            return res.status(200).json({ success: "Account created successfully", token, registerSuccess });
        }
        if (usertype === "restaurant") {
            const { firstname, lastname, phone, email, password, confirmpassword } = req.body;
            // Check password and cofirm password are same or not
            if (password !== confirmpassword) {
                return res.status(400).json({ error: "Password not Match with Confirm Password, Check it!" });
            }

            const findData = await Owner.findOne({ email });
            if (findData) {
                return res.status(400).json({ error: "This Email Address is already in used" });
            }

            const hashpass = await bcryptjs.hash(password, 10);

            const registerCustomer = new Owner({ firstname, lastname, phone, email, password: hashpass, usertype });

            // Generate token
            const token = await registerCustomer.generateAuthToken();

            const registerSuccess = await registerCustomer.save();
            if (!registerSuccess) {
                return res.status(400).json({ error: "Some error getting to create owner account" });
            }
            return res.status(200).json({ success: "Owner account created successfully", token, registerSuccess });
        }
    }
    catch (error) {
        console.log(error);
        return res.status(400).json({ error: "Some error getting in try catch while create an accont, solve it", error });
    }
})

// Login
router.post("/login/:usertype", async (req, res) => {
    const { email, password } = req.body;
    const usertype = req.params.usertype;
    try {
        if (usertype === 'customer') {
            // Find user by id
            const findData = await Customer.findOne({ email, usertype });
            if (!findData) {
                return res.status(400).json({ error: "User not found, Please Signup!" });
            }

            // Password Matching
            const pass_Match = await bcryptjs.compare(password, findData.password);

            if (!pass_Match) {
                return res.status(400).json({ error: "Please Login with correct credentials!" });
            }

            // Generate token
            const token = await findData.generateAuthToken();
            // console.log("Token Signin " + tokenSignin);

            // console.log("Login Successful");
            return res.status(200).json({ findData, success: "Welcome back", token });
        }
        if (usertype === 'restaurant') {
            // Find user by id
            const findData = await Owner.findOne({ email, usertype });
            if (!findData) {
                return res.status(400).json({ error: "Owner not found, Please Signup!" });
            }

            // Password Matching
            const pass_Match = await bcryptjs.compare(password, findData.password);

            if (!pass_Match) {
                return res.status(400).json({ error: "Please Login with correct credentials!" });
            }

            // Generate token
            const token = await findData.generateAuthToken();
            // console.log("Token Signin " + tokenSignin);

            // console.log("Login Successful");
            return res.status(200).json({ findData, success: "Welcome back Owner", token });
        }
    }
    catch (error) {
        console.log(error);
        // console.log("Some error getting in try catch while login, solve itSome error getting in try catch while login, solve it " + error);
        return res.status(400).json({ error: "Some error getting in try catch while login, solve it", error });
    }
})

// Update owner details
router.put("/editowner", auth, async (req, res) => {
    console.log(req.body);
    try {
        const { firstname, lastname, email, phone } = req.body;
        const updateObj = {};
        if (firstname) { updateObj.firstname = firstname };
        if (lastname) { updateObj.lastname = lastname };
        if (email) { updateObj.email = email };
        if (phone) { updateObj.phone = phone };

        // Find owner and update
        const updateOwner = await Owner.findByIdAndUpdate(req.userId, { $set: updateObj }, { new: true });
        if (!updateOwner) {
            return res.status(400).json({ error: "Owner not found in our database" });
        }
        return res.status(200).json({ updateOwner, success: "Profile details updated successfully" });
    }
    catch (error) {
        return res.status(400).json({ error: "Some error getting in catch block while update owner detail", error });
    }
})

// Update user details
router.put("/updateuser", auth, async (req, res) => {
    try {
        const { firstname, lastname, email, phone, age } = req.body;
        const dataObj = {};
        if (firstname) { dataObj.firstname = firstname }
        if (lastname) { dataObj.lastname = lastname }
        if (email) { dataObj.email = email }
        if (phone) { dataObj.phone = phone }
        if (age) { dataObj.age = age }

        // Find user and update
        const updateInfo = await Customer.findByIdAndUpdate(req.userId, { $set: dataObj }, { new: true }).select("-password -confirmpassword");
        if (!updateInfo) {
            return res.status(400).json({ error: "User not found in our database" });
        }
        // console.log("Profile details updated successfully");
        return res.status(200).json({ updateInfo, success: "Profile details updated successfully" });
    }
    catch (error) {
        // console.log("Some error getting in catch block while update user detail " + error);
        return res.status(400).json({ error: "Some error getting in catch block while update user detail", error });
    }
});

// Add address
router.post("/addaddress", auth, async (req, res) => {
    try {
        const { house, societyname, landmark, city, pincode, place } = req.body;
        const addAddress = new Address({ house, societyname, landmark, city, pincode, place, user: req.userId });
        const saveAddress = await addAddress.save();
        if (!saveAddress) {
            // console.log("Address not saved");
            return res.status(400).json({ error: "Address not saved" });
        }
        // console.log("Address saved");
        return res.status(200).json({ saveAddress, success: "Address saved" });
    }
    catch (error) {
        // console.log("Some error to add address", error);
    }
});

// Get address
router.get("/getaddress", auth, async (req, res) => {
    try {
        const user = req.userId;
        // find user by id and get address
        const findAddress = await Address.find({ user });
        if (!findAddress) {
            // console.log("No address are found");
            return res.status(400).json({ error: "No any address found" });
        }
        // console.log("Address are found");
        return res.status(200).json({ findAddress, success: "addresses are found" });
    }
    catch (error) {
        // console.log("Some error to get address", error);
    }
});

// Update address
router.put("/updateaddress/:id", auth, async (req, res) => {
    try {
        const { house, societyname, landmark, city, pincode, place } = req.body;

        const updateAddressObj = {};
        if (house) { updateAddressObj.house = house }
        if (societyname) { updateAddressObj.societyname = societyname }
        if (landmark) { updateAddressObj.landmark = landmark }
        if (city) { updateAddressObj.city = city }
        if (pincode) { updateAddressObj.pincode = pincode }
        if (place) { updateAddressObj.place = place }

        // find address to be updated and update it
        const findAddress = await Address.findById(req.params.id);
        // console.log(findAddress);
        if (!findAddress) {
            // console.log("No address found");
            return res.status(400).json({ error: "No address found" });
        }

        // Allow updation if user is owner his address
        if (findAddress.user.toString() !== req.userId.toString()) {
            // console.log("Request Deliced For Udate Address");
            return res.status(400).json({ error: "Request Deliced For Udate Address" });
        }

        // update
        const updateAddress = await Address.findByIdAndUpdate(req.params.id, { $set: updateAddressObj }, { new: true });
        if (!updateAddress) {
            // console.log("Some error to update address");
            return res.status(400).json({ error: "Some error to update address" });
        }
        // console.log("Address updated");
        return res.status(200).json({ updateAddress, success: "address updated" });
    }
    catch (error) {
        // console.log("Some error to update address", error);
    }
});

// Delete address
router.delete("/deleteaddress/:id", auth, async (req, res) => {
    try {
        // find address to be deleted and delete id
        const findAddress = await Address.findById(req.params.id);
        if (!findAddress) {
            // console.log("Address not found");
            return res.status(400).json({ error: "Address not found" });
        }

        // Allow deletion if user is owner his address
        if (findAddress.user.toString() !== req.userId.toString()) {
            // console.log("Request Decline for delete address");
            return status(400).json({ error: "Request decline for delete address" });
        }

        // delete
        const deleteAddress = await Address.findByIdAndDelete(req.params.id);
        if (!deleteAddress) {
            // console.log("Some error to delete address");
            return res.status(400).json({ error: "Some error to delete address" });
        }
        // console.log("Address deleted");
        return res.status(200).json({ success: "Address deleted" });
    }
    catch (error) {
        // console.log("Some error to delete address catch", error);
        return res.status(400).json({ error: "Some error to delete address", error });
    }
});

// Order food
router.post("/orderfood", auth, async (req, res) => {
    const { cart, oid, totalamount, finalamount, coupen, discountamount, deliverycharge, deliveryaddress, name, email, phone } = req.body;

    try {
        // Check if cart is tampered with (if tampered then order not placed in not then order placed)
        let subtotal = 0;
        for (let item in cart) {
            const cartFood = await Food.findOne({ _id: item }).select({ price: 1 });
            if (cartFood.price !== cart[item].price) return res.status(400).json({ success: false, error: "There is some changes in cart, try again!" });
            subtotal += cart[item].price * cart[item].qty;
        }
        if (subtotal !== totalamount) return res.status(400).json({ success: false, error: "There is some changes in cart, try again!" });

        //Order
        const createOrder = new Order({ food: cart, orderId: oid, totalamount, subtotal: finalamount, coupenapplied: coupen, discount: discountamount, deliverycharge, deliveryaddress, name, email, phone, user: req.userId });
        const storeOrder = await createOrder.save();
        if (!storeOrder) {
            return res.status(400).json({ success: false, error: "Something went wrong, Please try again!" });
        }

        //Payment
        var paytmParams = {};

        paytmParams.body = {
            "requestType": "Payment",
            "mid": process.env.PAYTM_MID,
            "websiteName": "WEBSTAGING",
            "orderId": oid,
            "callbackUrl": "http://localhost:5000/postOrder",
            "txnAmount": {
                "value": finalamount,
                "currency": "INR",
            },
            "userInfo": {
                "custId": email,
            },
        };

        PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), process.env.PAYTM_MKEY).then(function (checksum) {

            paytmParams.head = {
                "signature": checksum
            };

            var post_data = JSON.stringify(paytmParams);

            var options = {

                /* for Staging */
                hostname: 'securegw-stage.paytm.in',

                /* for Production */
                // hostname: 'securegw.paytm.in',

                port: 443,
                path: `/theia/api/v1/initiateTransaction?mid=${process.env.PAYTM_MID}&orderId=${oid}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': post_data.length
                }
            };

            var response = "";
            var post_req = https.request(options, function (post_res) {
                post_res.on('data', function (chunk) {
                    response += chunk;
                });

                post_res.on('end', function () {
                    return res.status(200).json({ success: true, data: JSON.parse(response).body });
                });
            });

            post_req.write(post_data);
            post_req.end();
        });

    }
    catch (error) {
        console.log(error);
        return res.status(400).json({ error: "Something went wrong!" });
    }
})

router.post("/postOrder", async (req, res) => {
    var paytmChecksum = "";
    var paytmParams = {};
    const received_data = req.body;
    for (let key in received_data) {
        if (key === 'CHECKSUMHASH') {
            paytmChecksum = received_data[key];
        }
        else {
            paytmChecksum[key] = received_data[key];
        }
    }
    var isValidChecksum = PaytmChecksum.verifySignature(paytmParams, process.env.PAYTM_MKEY, paytmChecksum);

    if (received_data.STATUS === "TXN_SUCCESS") {
        const orderUpdate = await Order.findOneAndUpdate({ orderId: received_data.ORDERID }, { status: "Paid" });
        if (orderUpdate) {
            return res.status(200).redirect('/account');
        }
    }
    return res.status(200).redirect('/cart');
})

router.post("/cancelpayment", async (req, res) => {
    console.log("post order called");
})

// Get order
router.get("/getorder", auth, async (req, res) => {
    try {
        const user = req.userId;
        // find user by id and get orders
        const findOrder = await Order.find({ user });
        if (!findOrder) {
            // console.log("No Order are found");
            return res.status(400).json({ error: "No any Order found" });
        }
        // console.log("Order are found");
        return res.status(200).json({ findOrder, success: "Order are found" });
    }
    catch (error) {
        // console.log("Some error to get order", error);
        return res.status(400).json({ error: "Some error to get order", error });
    }
});

// Get food
router.get("/getFood", async (req, res) => {
    try {
        const findFood = await Food.find();
        if (!findFood) return res.status(400).json({ error: "Something went wrong while fetching foods" });
        return res.status(200).json({ findFood });
    }
    catch (error) {
        return res.status(400).json({ error: "Some error to fetch food details by city name" });
    }
})

// Review
router.post("/review", auth, async (req, res) => {
    try {
        const { msg, rating, name } = req.body;
        if (!msg || !rating || rating > 5) {
            return res.status(400).json("Field can not be blank");
        }
        const review = await Review.findOne({ user: req.userId });
        if (review) {
            review.msg = msg;
            review.rating = rating;

            const saveReview = await review.save();

            if (!saveReview) return res.status(400).json("Some error to save reviews");

            return res.status(200).json('Review send,We will improve your suggestion.');
        }

        if (!msg) return res.status(400).json("Review box can not be empty")

        const createReview = new Review({ user: req.userId, msg, rating, name });

        const saveReview = await createReview.save();

        if (!saveReview) return res.status(400).json("Some error to save reviews");

        return res.status(200).json('Review send,We will improve your suggestion.');
    }
    catch (error) {
        return res.status(400).json("Some error to store rating");
    }
})

// Get Review
router.get("/review", async (req, res) => {
    try {
        const reviews = await Review.find();
        if (!reviews) return res.status(400).json("Some error to get reviews");

        return res.status(200).json(reviews);
    }
    catch (error) {
        return res.status(400).json("Some error to store rating");
    }
})

// Add Food
router.post("/addfood", auth, upload.single('foodimg'), async (req, res) => {
    const { foodname, hotel, price, category } = req.body;
    const url = req.protocol + '://' + req.get('host');
    try {
        const findFood = await Food.findOne({ foodname, hotel });
        if (findFood) return res.status(400).json("Food Is Already Serve From Your Restaurant");

        const createFoodData = new Food({ foodname, foodimg: url + '/public/' + req.file.filename, hotel, price, category, user: req.userId });

        const saveFood = await createFoodData.save();

        if (!saveFood) return res.status(400).json("Food Not Served");

        return res.status(200).json("Food Served!");
    } catch (error) {
        return res.status(400).json("Some error to add food " + error);
    }
})

// Update Food
router.put("/updatefood/:id", auth, upload.single('foodimg'), async (req, res) => {
    const { foodname, foodimg, hotel, price, category } = req.body;
    const url = req.protocol + '://' + req.get('host');
    try {
        let updateNoteObj = {};
        if (foodname) updateNoteObj.foodname = foodname;
        if (req.file) updateNoteObj.foodimg = url + '/public/' + req.file.filename;
        if (hotel) updateNoteObj.hotel = hotel;
        if (price) updateNoteObj.price = price;
        if (category) updateNoteObj.category = category;
        if (Object.keys(updateNoteObj).length === 0) return res.status(400).json("Please Enter Updated Values");

        const findFood = await Food.findById({ _id: req.params.id });
        if (!findFood) return res.status(400).json("Food Detail Not Find");

        if (findFood.user.toString() !== req.userId.toString()) return res.status(400).json("Access Denied for update food");

        const updateFood = await Food.findByIdAndUpdate(req.params.id, { $set: updateNoteObj }, { new: true });
        if (!updateFood) return res.status(400).json("Food Not Udpated");
        return res.status(200).json("Food Udpated");
    }
    catch (error) {
        console.log(error);
        return res.status(400).json("Some error to update food " + error);
    }
})

// Delete food
router.delete("/deletefood/:id", auth, async (req, res) => {
    try {
        const findFood = await Food.findById(req.params.id);
        if (!findFood) return res.status(400).json("Food Detail Not Find");

        if (req.userId.toString() !== findFood.user.toString()) return res.status(400).json("Access Denied for delete food");

        const deleteFood = await Food.findByIdAndDelete(req.params.id);
        if (!deleteFood) return res.status(400).json("Food Not Deleted");
        return res.status(200).json("Food Deleted");

    }
    catch (error) {
        return res.status(400).json("Some error to delete food " + error);

    }
})

// Get Restaurant food
router.get("/getrestaurantfood", auth, async (req, res) => {
    try {
        const findFood = await Food.find({ user: req.userId });
        if (!findFood) return res.status(400).json("Food Detail Not Find");
        return res.status(200).json(findFood);
    }
    catch (error) {
        return res.status(400).json("Some error to delete food " + error);

    }
})

// Get Pincodes
router.get("/pincodes", async (req, res) => {
    try {
        await pincodes;
        return res.status(200).json({ success: true, pincodes });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: "Something went wrong while fetching pincodes" });
    }
})

// Forgot Password
router.post("/forgotpassword", async (req, res) => {
    try {
        // send token using nodemailer
        if (req.body.canSendEmail) {

            const otpHolder = await Otp.find({ email: req.body.email });

            if (!otpHolder) return res.status(400).json({ success: false, error: "OTP was expire" });

            const rightOtp = otpHolder[otpHolder.length - 1];

            const comapreOtp = await bcryptjs.compare(req.body.otp, rightOtp.otp);

            if (comapreOtp && rightOtp.email === req.body.email) {

                const token = "nkjsnfkjnfjnvknfjnjfdnbjfdn";

                const forgot = new Forgot({
                    email: req.body.email,
                    token: token
                });

                await forgot.save();
                await Otp.deleteMany({ email: rightOtp.email });

                return res.status(200).json({ success: true, token, message: "Password reset intruction sended to your email id" });
            }

            else res.status(400).json({ success: false, error: "Wrong OTP!" });
        }

        else {
            console.log(req.body);
            if (req.body.password !== req.body.confirmpassword) return res.status(400).json({ success: false, error: "Passwords not matched" });

            const getToken = await Forgot.findOne({ token: req.headers.token });

            if (!getToken) return res.status(400).json({ success: false, error: "Password reset link was expires or invalid" });

            req.body.password = await bcryptjs.hash(req.body.password, 10);

            const userpass = await Customer.findOneAndUpdate({ email: getToken.email }, { password: req.body.password }, { new: true });

            const removeToken = await getToken.remove();

            if (!userpass || !removeToken) return res.status(400).json({ success: false, error: "Something went wrong" });

            return res.status(200).json({ success: true, message: "Password Changed successsfully" });

        }

    }

    catch (error) {
        console.log(error);
        return res.status(400).json({ success: false, error: "Something went wrong" });
    }
});

// Generate Otp
router.post("/sendotp", async (req, res) => {
    try {

        // send otp using nodemailer
        const user = await Customer.findOne({ email: req.body.email });

        if (!user) return res.status(400).json({ success: false, error: "User not found with this email id" });

        const OTP = otpGenerator.generate(6, {
            digits: true, alphabets: false, upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false
        });

        console.log(OTP);

        const otphash = await bcryptjs.hash(OTP, 10);

        const otp = new Otp({
            email: req.body.email,
            otp: otphash
        });

        await otp.save();
        return res.status(200).json({ success: true, OTP, message: "Otp sended to your email id." });
    }
    catch (error) {
        console.log(error);
        return res.status(400).json({ success: false, error: "Something went wrong" });
    }
});

// change password
router.put("/changepassword", auth, async (req, res) => {
    try {

        if (req.body.newpassword !== req.body.confirmnewpassword) return res.status(400).json({ success: false, error: "Passwords not matched" });

        if (req.body.newpassword === req.body.currentpassword) return res.status(400).json({ success: false, error: "New Password Should not Same as Current Password" });

        const user = await Customer.findById(req.userId);

        if (!user) return res.status(400).json({ success: false, error: "User not found" });

        const comparePass = await bcryptjs.compare(req.body.currentpassword, user.password);

        if (!comparePass) return res.status(400).json({ success: false, error: "Current Password is Wrong" });

        user.password = await bcryptjs.hash(req.body.newpassword, 10);

        const saveUser = await user.save();

        if (!saveUser) return res.status(400).json({ success: false, error: "Something went wrong" });

        return res.status(200).json({ success: true, message: "Password Changed" });

    }
    catch (error) {
        console.log(error);
        return res.status(400).json({ success: false, error: "Something went wrong" });
    }
});

module.exports = router