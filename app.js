const Client = require('uber-ride-request'),
    express = require('express'),
    app = express(),
    server = require('http').Server(app),
    port = process.env.PORT || 3030;

const uberConfig = {
    access_token: process.env.ACCESS_TOKEN,
    sandbox: process.env.SANDBOX || true
};

const freeConfig = {
    user: process.env.FREE_USER,
    pass: process.env.FREE_PASS
};

const uber = new Client.Uber(uberConfig.access_token, uberConfig.sandbox);
const free = new Client.Free(freeConfig.user, freeConfig.pass);

const address_1 = {
    'name': process.env.ADDRESS_1_NAME,
    'lat': process.env.ADDRESS_1_LAT,
    'lng': process.env.ADDRESS_1_LNG
};

const address_2 = {
    'name': process.env.ADDRESS_2_NAME,
    'lat': process.env.ADDRESS_2_LAT,
    'lng': process.env.ADDRESS_2_LNG
};

const distanceBetweenAddresses = distance(address_2.lat, address_2.lng, address_1.lat, address_1.lng) * 1000; // In meters

app.get('/', function (req, res) {
    res.send('App is running...');
});

app.get('/request/:device/:lat/:lng/:radius', function (req, res) {
    let device = req.params.device;
    let device_lat = req.params.lat;
    let device_lng = req.params.lng;
    let radius = req.params.radius;

    console.log("Device %s:\tlocated at\t%s°\t%s° within a %s meters radius", device, device_lat, device_lng, radius);

    if(radius <= distanceBetweenAddresses){
        // Calculate distances between addresses and the devices location
        let distanceTo1 = distance(device_lat, device_lng, address_1.lat, address_1.lng);
        let distanceTo2 = distance(device_lat, device_lng, address_2.lat, address_2.lng);
        console.log('----------------------------------------');
        console.log('Distance to 1 from device GPS: ' + distanceTo1);
        console.log('Distance to 2 from device GPS: ' + distanceTo2);
        console.log('----------------------------------------');
        // Request the UberX ride after checking which is the nearest address from the devices location
        requestUberX(distanceTo1, distanceTo2);
    } else {
        console.warn("Geoloc is not precise enough.");
        free.sendSMS("Geoloc is not precise enough.");
        res.send("Geoloc is not precise enough.");
    }
});

app.get('/request/current', function (req, res) {
    getCurrentRide(res);
});

app.get('/request/cancel', function (req, res) {
    uber.cancelCurrent().then(result => {
        if(result == 204){
            free.sendSMS("Canceled order successfully!");
            res.send("Canceled order successfully!");
            console.log("Canceled order successfully!");
        } else {
            res.send("No ride to cancel.");
        }
    });
});

function distance(lat1, lng1, lat2, lng2) {
    var p = 0.017453292519943295;    // Math.PI / 180
    var c = Math.cos;
    var a = 0.5 - c((lat2 - lat1) * p)/2 +
        c(lat1 * p) * c(lat2 * p) *
        (1 - c((lng2 - lng1) * p))/2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

function getCurrentRide(res){
    uber.getCurrent().then(result =>{
        let status = result.status;
        let eta = result.pickup.eta;
        console.log("Current status: " + status + ". Driver arrives in: " + eta + " minutes.");
        free.sendSMS("Current status: " + status + ".\nDriver arrives in: " + eta + " minutes.");
        if(typeof res !== 'undefined')
            res.send("Current status: " + status + ". Driver arrives in: " + eta + " minutes.");
    });
}

function requestUberX(distanceTo1, distanceTo2){
    if(distanceTo1 <= distanceTo2){
        // Order Uber to go to address 1
        console.log("Ordering Uber to go to " + address_2.name + "...");
        uber.start_lat = address_1.lat;
        uber.start_lng = address_1.lng;
        uber.end_lat = address_2.lat;
        uber.end_lng = address_2.lng;
        uber.seats = 2;

        uber.getUberXEstimate().then(result => {
            if(result != null){
                let distance_estimate = (result.trip.distance_estimate * 1.60934).toFixed(2);
                console.log("distance_estimate: " + distance_estimate);
                uber.getRequest().then(result => {
                    free.sendSMS("Ordered Uber to go to " + address_2.name + "!\nFor a distance of " + distance_estimate + " km");
                    res.send("Ordered Uber to go to " + address_2.name + "!");
                    console.log("Ordered Uber to go to " + address_2.name + "!");
                    setTimeout(function(){
                        getCurrentRide();
                    }, 60000);
                });
            } else {
                console.warn("No UberX arround you.");
                free.sendSMS("No UberX arround you.");
                res.send("No UberX arround you.");
            }
        });
    } else {
        // Order Uber to go to address 2
        console.log("Ordering Uber to go to " + address_1.name + "...");
        uber.start_lat = address_2.lat;
        uber.start_lng = address_2.lng;
        uber.end_lat = address_1.lat;
        uber.end_lng = address_1.lng;
        uber.seats = 2;

        uber.getUberXEstimate().then(result => {
            if(result != null){
                let distance_estimate = (result.trip.distance_estimate * 1.60934).toFixed(2);
                console.log("distance_estimate: " + distance_estimate);
                uber.getRequest().then(result => {
                    free.sendSMS("Ordered Uber to go to " + address_1.name + "!\nFor a distance of " + distance_estimate + " km");
                    res.send("Ordered Uber to go to " + address_1.name + "!");
                    console.log("Ordered Uber to go to " + address_1.name + "!");
                    setTimeout(function(){
                        getCurrentRide();
                    }, 60000);
                });
            } else {
                console.warn("No UberX arround you.");
                free.sendSMS("No UberX arround you.");
                res.send("No UberX arround you.");
            }
        });
    }
}


server.listen(port, function () {
    console.log('App listening on http://localhost:' + port);
});