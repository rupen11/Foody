require('dotenv').config();
const mongoose = require("mongoose");
const bcryptjs = require("bcrypt");
const jwt = require("jsonwebtoken");

const customerSchema = new mongoose.Schema({
    firstname: {
        type: String,
        require: true
    },
    lastname: {
        type: String,
        require: true
    },
    email: {
        type: String,
        require: true,
        unique: true
    },
    password: {
        type: String,
        require: true
    },
    confirmpassword: {
        type: String,
        require: true
    },
    phone: {
        type: Number,
        require: true,
        min: 10
    },
    usertype: {
        type: String,
        require: true
    },
    tokens: [{
        token: {
            type: String,
            require: true
        }
    }]
});

// Generate token
customerSchema.methods.generateAuthToken = async function (req, res) {
    try {
        const token = jwt.sign({ _id: this.id.toString() }, process.env.SECRET_KEY);
        this.tokens = this.tokens.concat({ token: token });
        await this.save();
        return token;
    }
    catch (error) {
        console.log("Some error to generate token " + error);
    }
}

// Password hasing
customerSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcryptjs.hash(this.password, 10);
        this.confirmpassword = await bcryptjs.hash(this.confirmpassword, 10);
    }
    next();
});

const Customer = new mongoose.model("customers", customerSchema);

module.exports = Customer;

// mynameisrjandthisisfoodwebsite