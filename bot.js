const connectDB = require("./database");
const User = require("./models/User"); // Import User Model
const Deposit = require("./models/Deposit"); // Import Deposit Model
const Withdraw = require("./models/Withdraw"); // Import Withdraw Model
const mongoose = require("mongoose"); // Import Mongoose
const express = require("express");

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Bot connected to MongoDB Atlas"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const { Markup, Scenes, session, Telegraf } = require("telegraf");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Registration Scene
const registrationScene = new Scenes.BaseScene("registration");

registrationScene.enter(async (ctx) => {
    if (!ctx.from || !ctx.from.id) {
        return ctx.reply("⚠️ An error occurred while fetching your ID. Please restart the bot.");
    }

    const uid = ctx.from.id;
    const referrerUid = ctx.startPayload || null; // Capture referral UID if available

    try {
        // Check registration limit (Max: 20 users)
        const totalUsers = await User.countDocuments();
        if (totalUsers >= 20) {
            return ctx.reply("🚫 Registration limit reached! Only 20 users can join this bot.");
        }

        // Check if the user is already registered
        let user = await User.findOne({ uid });
        if (user) {
            return ctx.reply("👋 Welcome back! Use the menu below to navigate.", mainMenu);
        }

        // Store user details temporarily in the scene state
        ctx.scene.state.uid = uid;
        ctx.scene.state.referrerUid = referrerUid;

        return ctx.reply("📝 Please enter a unique username:");
    } catch (error) {
        console.error("Error in start command:", error);
        ctx.reply("⚠️ An error occurred while registering. Please try again.");
        return ctx.scene.leave();
    }
});

// Step 2: Handle username input
registrationScene.hears(/.*/, async (ctx) => {
    const username = ctx.message.text.trim();

    // Ensure scene state is not lost
    if (!ctx.scene.state.uid) {
        return ctx.reply("⚠️ Registration data lost. Please restart by typing /start.");
    }

    const uid = ctx.scene.state.uid;
    const referrerUid = ctx.scene.state.referrerUid;

    try {
        // Check if username is already taken
        let existingUser = await User.findOne({ username });
        if (existingUser) {
            return ctx.reply("❌ This username is already taken. Please enter another one:");
        }

        // Register new user
        let newUser = new User({
            uid,
            username,
            registrationDate: new Date(),
            referredBy: referrerUid // Store referrer UID if available
        });

        await newUser.save();

        ctx.reply(`🎉 Welcome, *${username}*! Your account has been registered successfully.`, { parse_mode: "Markdown" });

        // Show main menu
        showMainMenu(ctx);
        ctx.scene.leave();
    } catch (error) {
        console.error("Error saving user:", error);
        ctx.reply("⚠️ An error occurred. Please try again.");
    }
});

// Function to show the main menu
function showMainMenu(ctx) {
    ctx.reply("🏠 *Main Menu:*", { 
        parse_mode: "Markdown",
        ...mainMenu
    });
}

// Permanent Reply Keyboard
const mainMenu = Markup.keyboard([
    ["✅ Check-in", "ℹ️ About"],
    ["💰 Deposit", "📤 Withdraw"],
    ["📊 Balance", "👥 Affiliate"],
    ["📌 Profile"]
])
    .resize()
    .oneTime(false);

// Register Scenes & Middleware
const stage = new Scenes.Stage([registrationScene]);
bot.use(session());
bot.use(stage.middleware());

// Start command triggers the registration process
bot.start((ctx) => ctx.scene.enter("registration"));

// Check-in button

const moment = require("moment"); // Ensure moment.js is installed (npm install moment)

bot.hears("✅ Check-in", async (ctx) => {
    if (!ctx.from || !ctx.from.id) {
        return ctx.reply("⚠️ An error occurred while fetching your ID. Please restart the bot.");
    }

    const uid = ctx.from.id;
    const today = moment().startOf("day"); // Midnight today

    // ❌ No rewards on the 6th of every month
    if (today.date() === 6) {
        return ctx.reply(
            "❌ No rewards on the 6th of every month. 🚫💰\n\n" +
            "🔄 Come back tomorrow! ⏳😊",
            { parse_mode: "Markdown" }
        );
    }

    try {
        // Fetch user from the database
        let user = await User.findOne({ uid });

        // Check if user exists
        if (!user) {
            return ctx.reply("❌ You are not registered! Send /start to register.", mainMenu);
        }

        // Check if the user's account is active
        if (!user.status || user.status !== "active") {
            return ctx.reply(
                "Your account is inactive ❎. Purchase a plan to activate your account ☺️",
                mainMenu
            );
        }

        // Get last check-in date
        const lastCheckIn = user.lastCheckIn ? moment(user.lastCheckIn).startOf("day") : null;

        // Check if the user already checked in today
        if (lastCheckIn && lastCheckIn.isSame(today)) {
            return ctx.reply("✅ You have already checked in today. Come back tomorrow!", mainMenu);
        }

        // ✅ Grant Check-in Reward (₹40)
        user.balance = (user.balance || 0) + 40; // Ensure balance is always valid
        user.lastCheckIn = new Date();
        await user.save();

        // Send success message
        ctx.reply(
            "✅ *You have successfully checked in!* 🎉\n\n" +
            "💰 Your balance has been increased by *+₹40*. 📈\n\n" +
            "🔄 *Come back tomorrow to check-in again!* ⏳😊",
            { parse_mode: "Markdown" }
        );

        // Send updated balance message
        ctx.reply(
            `💵 *Your updated balance is now: ₹${user.balance}* 🎊🚀\n\n` +
            "🔹 Keep checking in daily to earn more rewards! 🎁",
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error in check-in process:", error);
        ctx.reply("⚠️ An unexpected error occurred. Please try again later.");
    }
});


// Handle About button

bot.hears("ℹ️ About", (ctx) => {
    const aboutMessage = `
ℹ️ *About TSHM_GROW* ℹ️

📌 *How It Works:*  
- Deposit ₹390 and earn ₹40 daily.  
- Withdraw your earnings anytime after reaching the requirements.  
- Refer friends and earn additional rewards.

💼 *Features:*  
✔ Secure transactions  
✔ Fast withdrawals  
✔ Passive earnings  

📌 *Rules:*  
- Must read the deposit 💰, withdraw 📤, and affiliate 👥 rules 📜 for any queries.  
- Once registered, come every day to check-in ✅ and get your reward 💵.  
- If a user doesn't check-in ✅, their reward 💵 will not be ❌ credited.  
- Company holiday is on *6th of every month ☺️*.  
- No reward will be distributed on company holidays.

📞 *Support:* Contact tshmgrow@gmail.com for queries.

🚀 *Start earning today!*
    `;

    ctx.reply(aboutMessage, { parse_mode: "Markdown" }, mainMenu);
});


// 💰 Deposit Menu Keyboard (Always Visible)
const depositMenu = Markup.keyboard([
    ["📜 Rules", "📊 Plans"],
    ["💳 Purchase", "📂 Deposit History"],
    ["⬅ Back to Main Menu"]
]).resize();

// Deposit Button Action (Opens Deposit Menu)
bot.hears("💰 Deposit", (ctx) => {
    ctx.reply("💰 *Deposit Menu:* Choose an option below:", {
        parse_mode: "Markdown",
        ...depositMenu
    });
});

//Rules button
bot.hears("📜 Rules", (ctx) => {
    ctx.reply("📜 *Deposit Rules:* \n- Rule 1: Send the payment 💳 screenshot in the google form link.\n- Rule 2: User's sending multiple transaction for the same plan will not get refunded ❌.\n- Rule 3: Once deposit is completed your account will be activated within 24-48hrs. Wait patiently....☺️", {
        parse_mode: "Markdown",
        ...depositMenu
    });
});

bot.hears("📊 Plans", (ctx) => {
    ctx.reply("📊 *Plans:*\n\nℹ️ Starter Pack: ℹ️\n💰 Plan Amount: ₹390\n📆 Validity: Last date of every month.\n💵 Daily Revenue: ₹40.\n\n🔔 Note:\n1️⃣ Must check-in ✅ daily after purchasing the plan.\n2️⃣ For better revenue 💹, don't purchase the plan after the 15th of every month. (Follow strictly ❗ otherwise, you will not be able to withdraw. 🚫💸)\n3️⃣ Must re-activate 🔄 the plan by depositing ₹150 on the 1st of every month, otherwise no withdrawals will be accepted. 🚫💰\n4️⃣ Re-activation period: 🗓️ 1st to 3rd of every month.\n5️⃣ If the user don't re-activate the plan ❌, his earnings will be stopped ⏸️. Thus the user will have to re-purchase the entire plan 🛒 to become an active user ✅ again.\n\nMore plans coming soon.....", {
        parse_mode: "Markdown",
        ...depositMenu
    });
});

// Purchase button
bot.hears("💳 Purchase", (ctx) => {
    const purchaseMenu = Markup.keyboard([
        ["🆕 Purchase Plan", "🔄 Re-activate Plan"],
        ["⬅ Back to Deposit"]
    ])
    .resize()
    .oneTime(false);

    ctx.reply("💳 *Purchase Instructions:* \n\n1️⃣ *Purchase Plan* → For users to purchase a plan.\n2️⃣ *Re-activate Plan* → For users renewing their plan.", {
        parse_mode: "Markdown",
        ...purchaseMenu
    });
});

// Temporary object to track user location
const userStates = {}; 

// Function to keep only the 4 newest deposits
async function manageDepositLimit(uid) {
    const count = await Deposit.countDocuments({ uid });

    if (count > 4) {
        await Deposit.findOneAndDelete({ uid }, { sort: { date: 1 } }); // Deletes the oldest deposit
    }
}

// Fetch User Safely
async function getUser(uid) {
    if (!uid) return null;
    return await User.findOne({ uid });
}

// Handle Purchase Plan
bot.hears("🆕 Purchase Plan", async (ctx) => {
    const uid = ctx.from?.id;
    if (!uid) return ctx.reply("❌ Error: Could not retrieve user ID.");

    const user = await getUser(uid);
    if (!user) return ctx.reply("❌ User not found. Please register first.");

    userStates[uid] = { step: "waiting_for_plan", type: "first_deposit" };

    ctx.reply(`Hello ${user.username} 👋,\n🚀 Good luck on your investment journey! 💰📈\n\n💡 Type the plan you want to purchase ⬇️✨\n\nAvailable Plans => *Starter Pack*`, 
    { parse_mode: "Markdown" });
});

// Handle Plan Selection
bot.hears(/^starter pack$/i, (ctx) => {
    const uid = ctx.from?.id;
    if (!uid || !userStates[uid] || userStates[uid].step !== "waiting_for_plan") return;

    userStates[uid].step = "waiting_for_proceed";

    ctx.reply("💰 You need to deposit ₹390 to continue.\n🔗 Type *Proceed* to get the payment link. ✅", { parse_mode: "Markdown" });
});

// Handle Proceed Action
bot.hears(/^proceed$/i, async (ctx) => {
    const uid = ctx.from?.id;
    if (!uid || !userStates[uid] || userStates[uid].step !== "waiting_for_proceed") return;

    try {
        const newDeposit = new Deposit({
            uid,
            amount: 390,
            date: new Date(),
            status: "pending",
            isReactivation: false
        });

        await newDeposit.save();
        await manageDepositLimit(uid);
        delete userStates[uid];

        ctx.reply("💳 *Payment Instructions:*\n\n1️⃣ Click the link below to complete your deposit:\n[Payment Link:]\nhttps://superprofile.bio/vp/67db95df6268760013723595\n\n2️⃣ After payment, submit your payment proof here:\n[Google Form Link:]\nhttps://forms.gle/oiVxY9s2NEUykm3m8\n\n3️⃣ Your account will be activated within *24-48 hours* after verification. ✅", 
        { parse_mode: "Markdown", disable_web_page_preview: true });
    } catch (error) {
        console.error("Error saving deposit:", error);
        ctx.reply("❌ Error processing deposit. Please try again later.");
    }
});

// Handle Re-activate Plan button
bot.hears("🔄 Re-activate Plan", async (ctx) => {
    const uid = ctx.from?.id;
    if (!uid) return ctx.reply("❌ Error: Could not retrieve user ID.");

    const user = await getUser(uid);
    if (!user) return ctx.reply("❌ User not found. Please register first.");

    userStates[uid] = { step: "waiting_for_reactivate_plan", type: "reactivation" };

    ctx.reply(`Hello ${user.username} 👋,\n🔄 Ready to continue your investment journey? 💰📈\n\n💡 Type the plan you want to re-activate ⬇️✨\n\nAvailable Plans => *Starter Pack Re-Activate*`, 
    { parse_mode: "Markdown" });
});

// Handle Plan Selection for Re-Activation
bot.hears(/^starter pack re-activate$/i, (ctx) => {
    const uid = ctx.from.id;

    if (!userStates[uid] || userStates[uid].step !== "waiting_for_reactivate_plan" || userStates[uid].type !== "reactivation") return;

    userStates[uid].step = "waiting_for_reactivate"; // Update user state

    ctx.reply("💰 You need to deposit ₹150 to re-activate your plan.\n\n🔗 Type *Re-Activate* to get the payment link. ✅", { parse_mode: "Markdown" });
});

// Handle Re-Activate Action
bot.hears(/^re-activate$/i, async (ctx) => {
    const uid = ctx.from?.id;
    if (!uid || !userStates[uid] || userStates[uid].step !== "waiting_for_reactivate") return;

    try {
        const newDeposit = new Deposit({
            uid,
            amount: 150,
            date: new Date(),
            status: "pending",
            isReactivation: true
        });

        await newDeposit.save();
        await manageDepositLimit(uid);
        delete userStates[uid];

        ctx.reply("💳 *Re-activation Payment Instructions:*\n\n1️⃣ Click the link below to complete your ₹150 payment:\n[Cosmofeed Payment Link:]\nhttps://superprofile.bio/vp/67db95713522a40013bbfaf7\n\n2️⃣ After payment, submit your payment proof here:\n[Google Form Link:]\nhttps://forms.gle/oiVxY9s2NEUykm3m8\n\n3️⃣ Your plan will be reactivated within *24-48 hours* after verification. ✅", 
        { parse_mode: "Markdown", disable_web_page_preview: true });
    } catch (error) {
        console.error("Error saving deposit:", error);
        ctx.reply("❌ Error processing re-activation deposit. Please try again later.");
    }
});

// Handle Deposit History Button
bot.hears("📂 Deposit History", async (ctx) => {
    const uid = ctx.from?.id;
    if (!uid) return ctx.reply("❌ Error: Could not retrieve user ID.");

    try {
        const deposits = await Deposit.find({ uid });

        if (!deposits || deposits.length === 0) {
            return ctx.reply("❌ No deposit records found.");
        }

        let historyMessage = "📂 *Your Deposit History:*\n\n";
        deposits.forEach((deposit) => {
            const formattedDate = new Date(deposit.date).toISOString().split("T")[0];
            historyMessage += `💰 *Amount:* ₹${deposit.amount}\n📅 *Date:* ${formattedDate}\n✅ *Status:* ${deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}\n🔄 *Type:* ${deposit.isReactivation ? "Re-activating" : "Purchasing"}\n-------------------------\n`;
        });

        ctx.reply(historyMessage, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Error fetching deposit history:", error);
        ctx.reply("❌ Error fetching deposit history. Please try again later.");
    }
});

// Handle Back Button to return to Deposit Menu
bot.hears("⬅ Back to Deposit", (ctx) => {
    ctx.reply("💰 *Deposit Menu:* Choose an option below:", depositMenu);
});

// Handle Back to Main Menu
bot.hears("⬅ Back to Main Menu", (ctx) => {
    ctx.reply("🔙 Returning to the main menu...", mainMenu);
});

//Withdraw button

// Withdraw Menu
const withdrawMenu = Markup.keyboard([
    ["📜 Withdraw Rules", "💰 Payout"],
    ["📂 Withdraw History"],
    ["⬅ Back to Main Menu"]
]).resize();

// Withdraw Button
bot.hears("📤 Withdraw", (ctx) => {
    ctx.reply("💸 *Withdraw Menu:* Choose an option below:", {
        parse_mode: "Markdown",
        ...withdrawMenu
    });
});

// Withdraw Rules
bot.hears("📜 Withdraw Rules", (ctx) => {
    ctx.reply(
        "📜 *Withdraw Rules:*\n\n" +
        "1️⃣ Withdrawals allowed only from the 2nd to 25th of each month.\n" +
        "2️⃣ Only active users can withdraw funds ✅.\n" +
        "3️⃣ Approval within 24-72 hours ⏳.\n" +
        "4️⃣ Name on withdrawal must match UPI name ⚠️.\n" +
        "5️⃣ 10% processing fee (subject to change 📉).\n" +
        "6️⃣ First withdrawal fixed at ₹400.\n" +
        "7️⃣ Future withdrawals: Min ₹650 | Max ₹1100.\n" +
        "8️⃣ Daily Limit: 1 withdrawal per day.\n" +
        "9️⃣ Monthly Limit: 2 withdrawals per month.\n" +
        "🔟 Limits may change as the platform grows 🚀.",
        { parse_mode: "Markdown" }
    );
});

// Withdraw Session Data
const userWithdrawals = new Map();

// Handle Payout
bot.hears("💰 Payout", async (ctx) => {
    const uid = ctx.from.id;
    if (!uid) return ctx.reply("❌ Unable to fetch your user ID.");

    try {
        let user = await User.findOne({ uid });

        if (!user) {
            return ctx.reply("❌ You are not registered! Send /start to register.");
        }

        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;

        if (day < 2 || day > 25) {
            return ctx.reply("❌ Withdrawals are allowed only from the 2nd to 25th of each month.");
        }

        let withdrawalsThisMonth = await Withdraw.find({
            uid,
            date: {
                $gte: new Date(today.getFullYear(), month - 1, 1),
                $lt: new Date(today.getFullYear(), month, 1)
            }
        });

        let lastWithdrawal = withdrawalsThisMonth[withdrawalsThisMonth.length - 1];

        if (lastWithdrawal && new Date(lastWithdrawal.date).getDate() === day) {
            return ctx.reply("❌ You can only withdraw once per day. Try again tomorrow!");
        }

        if (withdrawalsThisMonth.length >= 2) {
            return ctx.reply("❌ You have reached the limit of 2 withdrawals per month.");
        }

        if (user.status !== "active") {
            return ctx.reply("❌ Your account is inactive. Purchase a plan to activate withdrawals!");
        }

        if (withdrawalsThisMonth.length === 0) {
            if (user.balance < 400) {
                return ctx.reply("❌ Insufficient balance! Minimum required: ₹400.");
            }

            userWithdrawals.set(uid, { step: "upi", amount: 400 });
            return ctx.reply("You are eligible to withdraw ₹400. Enter your UPI ID 🔢💳.");
        } else {
            userWithdrawals.set(uid, { step: "amount" });
            return ctx.reply("Enter the amount to withdraw (₹650 - ₹1100) 🤑.");
        }
    } catch (error) {
        console.error("Error processing payout:", error);
        ctx.reply("❌ An error occurred. Please try again later.");
    }
});

// Step 1: Enter withdrawal amount
bot.hears(/^\d+$/, async (ctx) => {
    const uid = ctx.from.id;
    const session = userWithdrawals.get(uid);
    if (!session || session.step !== "amount") return;

    let amount = parseInt(ctx.message.text);
    if (amount < 650 || amount > 1100) {
        return ctx.reply("❌ Enter a valid amount between ₹650 - ₹1100.");
    }

    let user = await User.findOne({ uid });
    if (!user || user.balance < amount) {
        return ctx.reply("❌ Insufficient balance!");
    }

    session.amount = amount;
    session.step = "upi";
    userWithdrawals.set(uid, session);
    ctx.reply("Enter your UPI ID 🔢💳.");
});

// Step 2: Enter UPI ID
bot.hears(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/, async (ctx) => {
    const uid = ctx.from.id;
    const session = userWithdrawals.get(uid);
    if (!session || session.step !== "upi") return;

    session.upi = ctx.message.text;
    session.step = "name";
    userWithdrawals.set(uid, session);
    ctx.reply("Enter your name as per UPI ID 📝✨.");
});

// Step 3: Enter Name & Process Withdrawal
bot.hears(/^[A-Za-z ]+$/, async (ctx) => {
    const uid = ctx.from.id;
    const session = userWithdrawals.get(uid);
    if (!session || session.step !== "name") return;

    session.name = ctx.message.text;

    try {
        let user = await User.findOne({ uid });

        if (!user) {
            return ctx.reply("❌ User not found! Please register again.");
        }

        user.balance -= session.amount;
        await user.save();

        let newWithdraw = new Withdraw({
            uid,
            amount: session.amount,
            upi_id: session.upi,
            name: session.name,
            date: new Date(),
            status: "pending"
        });

        await newWithdraw.save();
        userWithdrawals.delete(uid);

        return ctx.reply("🎉 Withdrawal Successful! Your request will be processed within 24-72 hours.");
    } catch (error) {
        console.error("Error saving withdrawal:", error);
        ctx.reply("❌ An error occurred while processing your withdrawal. Try again later.");
    }
});

// Withdraw History
bot.hears("📂 Withdraw History", async (ctx) => {
    const uid = ctx.from.id;
    let withdrawals = await Withdraw.find({ uid }).sort({ date: -1 }).limit(4);

    if (!withdrawals.length) {
        return ctx.reply("❌ No withdrawal history found.");
    }

    let message = "📂 *Your Withdrawal History:*\n\n";
    withdrawals.forEach(withdraw => {
        let formattedDate = withdraw.date.toISOString().split('T')[0];
        message += `💰 *Amount:* ₹${withdraw.amount}\n📅 *Date:* ${formattedDate}\n🔄 *Status:* ${withdraw.status}\n💳 *Type:* UPI\n`;
        message += "------------------------\n";
    });

    ctx.reply(message, { parse_mode: "Markdown" });
});

// Back to Main Menu
bot.hears("⬅ Back to Main Menu", (ctx) => {
    ctx.reply("🔙 Returning to the main menu...");
});

// Balance button

bot.hears("📊 Balance", async (ctx) => {
    try {
        const uid = ctx.from.id; // Extract user ID from Telegram context
        
        // Fetch user data from database
        let user = await User.findOne({ uid });

        if (!user) {
            return ctx.reply("❌ You are not registered! Send /start to register.");
        }

        ctx.reply(
            `Hey *${user.username}*! 👋😊💰\n\n` +
            `✨ *Your Current Balance* ✨\n` +
            `💵📈 ₹${user.balance}`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        console.error("Error fetching user balance:", error);
        ctx.reply("⚠️ An error occurred while fetching your balance. Please try again later.");
    }
});


//Affiliate Button

bot.hears("👥 Affiliate", async (ctx) => {
    try {
        const uid = ctx.from.id;
        let user = await User.findOne({ uid });

        if (!user) {
            return ctx.reply("❌ You are not registered! Send /start to register.");
        }

        const botInfo = await bot.telegram.getMe();
        const botUsername = botInfo.username;
        const username = ctx.from.username || `user${uid}`;
        const referralLink = `https://t.me/${botUsername}?start=${uid}`;
        const totalReferrals = await User.countDocuments({ referredBy: uid });
        const totalReferralEarnings = user.referralBalance || 0;

        const inlineKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback("🔄 Move to Balance", "move_to_balance")]
        ]);

        ctx.reply(
            `👥 *Hello ${username}!* \n\n🌟 *Refer & Earn!* 🌟\n\n` +
            `📌 You have referred: *${totalReferrals}* users\n` +
            `💰 Earnings from referrals: *₹${totalReferralEarnings}*\n\n` +
            `📢 Share your referral link and earn rewards:\n🔗 [${referralLink}](${referralLink})\n\n` +
            `*💵 Earn ₹20 for each friend who activates their account!* 🎉\n\n` +
            `⚠️ *Minimum ₹100 is required to move to balance. 💰🔻*`,
            {
                parse_mode: "Markdown",
                disable_web_page_preview: true,
                ...inlineKeyboard,
            }
        );

    } catch (error) {
        console.error("Error fetching affiliate data:", error);
        ctx.reply("⚠️ An error occurred while fetching your affiliate data. Please try again later.");
    }
});

// Handle Move to Balance Button
bot.action("move_to_balance", async (ctx) => {
    const uid = ctx.from.id;

    try {
        let user = await User.findOne({ uid });

        if (!user) {
            return ctx.answerCbQuery("❌ You are not registered! Send /start to register.", { show_alert: true });
        }

        if (user.referralBalance < 100) {
            return ctx.answerCbQuery("❌ You need at least ₹100 in referral earnings to move to balance!", { show_alert: true });
        }

        // Deduct ₹100 from referralBalance and add to balance
        user.referralBalance -= 100;
        user.balance = (user.balance || 0) + 100;

        await user.save();

        return ctx.answerCbQuery("✅ ₹100 has been moved to your balance successfully!", { show_alert: true });

    } catch (error) {
        console.error("Error processing move to balance:", error);
        ctx.answerCbQuery("❌ An error occurred while moving to balance. Try again later.", { show_alert: true });
    }
});


// Profile button

bot.hears("📌 Profile", async (ctx) => {
    try {
        const uid = ctx.from.id; // Ensure `uid` is extracted properly

        // Fetch user data from the database
        let user = await User.findOne({ uid });

        if (!user) {
            return ctx.reply("❌ You are not registered! Send /start to register.");
        }

        // Check account status (Ensure `user.status` exists)
        const status = user.status && user.status === "active" ? "✅ Active" : "❌ Inactive";

        // Format the registration date safely
        const registrationDate = user.registrationDate
            ? moment(user.registrationDate).format("DD MMM YYYY")
            : "Unknown";

        ctx.reply(
            `👤 *Your Profile* 📌\n\n` +
            `👤 *Username:* ${user.username || "N/A"}\n` +
            `🆔 *UID:* ${user.uid}\n` +
            `📌 *Status:* ${status}\n` +
            `📅 *Member since:* ${registrationDate}`,
            { parse_mode: "Markdown" }
        );

    } catch (error) {
        console.error("Error fetching profile data:", error);
        ctx.reply("⚠️ An error occurred while fetching your profile. Please try again later.");
    }
});


// Launch the bot
bot.launch().then(() => {
    console.log("🚀 Bot is running...");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));


// Express server to keep Render service alive
const app = express();
app.get("/", (req, res) => {
  res.send("Bot is running...");
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});