let paymentPlanTable = base.getTable('Payment Plan');
let scheduleOfPaymentsTable = base.getTable('Schedule of Payments');

let newPaymentPlan = await input.recordAsync('Select a payment plan', paymentPlanTable);

if (!newPaymentPlan) {
    output.text('No record selected. Exiting script.');
    return; // Exit the script if no record is selected
}

let paymentPlanStatusObject = newPaymentPlan.getCellValue('Payment Plan Status');
let paymentPlanStatusName = paymentPlanStatusObject.name;
let paymentLength = newPaymentPlan.getCellValue('Payment Length (Months)');
let totalAmount = newPaymentPlan.getCellValue('Product Value');
let monthlyCost;
let subscriptionMonths;

function computeDueDate(monthOffset) {
    let currentDate = new Date();
    return new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + monthOffset,
        currentDate.getDate()
    );
}

let createdPayments = [];

async function createPaymentRecord(amount, monthOffset) {
    let recordData = {
        'Payment Plan': [{id: newPaymentPlan.id}],
        'Month Amount': amount,
        'Due Date': computeDueDate(monthOffset),
        'Month': monthOffset + 1,
        'Note': `Created by script on ${new Date().toISOString().split('T')[0]}`
    };
    await scheduleOfPaymentsTable.createRecordAsync(recordData);
    createdPayments.push(recordData);
}

if (paymentPlanStatusName === "Subscription") {
    let monthlyCostInput = await input.textAsync('Enter the monthly cost:');
    monthlyCost = parseFloat(monthlyCostInput);

    if (isNaN(monthlyCost)) {
        output.text('Invalid input for monthly cost. Please enter a valid number.');
        return;
    }

    let subscriptionMonthsInput = await input.textAsync('Enter the number of months for the subscription:');
    let subscriptionMonths = parseInt(subscriptionMonthsInput);

    if (isNaN(subscriptionMonths) || subscriptionMonths <= 0) {
        output.text('Invalid input for subscription months. Please enter a valid positive number.');
        return;
    }

    for (let i = 0; i < subscriptionMonths; i++) {
        await createPaymentRecord(monthlyCost, i);
    }
} else if (paymentLength && totalAmount) {
    let shouldDivideEqually = await input.buttonsAsync(
        'How should the payments be divided?',
        ['Equally', 'Custom Input']
    );

    if (shouldDivideEqually === 'Equally') {
        let equalAmount = totalAmount / paymentLength;

        for (let i = 0; i < paymentLength; i++) {
            await createPaymentRecord(equalAmount, i);
        }
    } else {
        let totalCustomAmount = 0;
        output.text(`The total price of the product is: £${totalAmount}.  The custom amounts must equal the total price of the price`)
        for (let i = 0; i < paymentLength; i++) {
            let customAmountInput = await input.textAsync(`Enter amount for month ${i + 1}:`);
            let customAmount = parseFloat(customAmountInput);

            if (isNaN(customAmount)) {
                output.text('Invalid input. Please enter a valid number.');
                return;
            }

            totalCustomAmount += customAmount;
            await createPaymentRecord(customAmount, i);
        }

        if (totalCustomAmount !== totalAmount) {
            output.text('Custom amounts do not equal total price');
        }
    }
}

let totalCreatedPayments = createdPayments.reduce((sum, recordData) => sum + recordData['Month Amount'], 0);

output.text('Created Schedule of Payments:');
createdPayments.forEach(recordData => {
    output.text(`Month: ${recordData['Month']}, Amount: ${parseFloat(recordData['Month Amount'].toFixed(2))}, Due Date: ${recordData['Due Date'].toISOString().split('T')[0]}`);
});

output.text(`Total of Created Payments: ${totalCreatedPayments.toFixed(2)}`);
if (paymentPlanStatusName === "Subscription") {
    output.text(`Number of created payments (${createdPayments.length}) at (£${monthlyCost}) per month`);
} else if (paymentLength && totalAmount) {
    if (parseFloat(totalCreatedPayments.toFixed(2)) !== parseFloat(totalAmount.toFixed(2))) {
        output.text(`Expected Total Amount: ${totalAmount.toFixed(2)}`);
        output.text(`Actual Total of Created Payments: ${totalCreatedPayments.toFixed(2)}`);
        output.text('Warning: Total of created payments does not match expected total.');
    }
    if (createdPayments.length !== paymentLength) {
        output.text(`Warning: Number of created payments (${createdPayments.length}) does not match expected ${paymentLength} months.`);
    }
}
