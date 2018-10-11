console.log('Entered Outbound Integration: "Notification Responses"');

// Load shared libraries
var clone = require('Clone Util');

// Parse and fixup the inbound payload
var payload = JSON.parse(request.body);
clone.fixPayload(payload);

// Take an action based on the first word of the response
var response = payload.response.toLowerCase().split(" ")[0];
switch (response) {
    
    // If "inform" then clone the form and send to stakeholders
    case "inform": {
            var response = clone.cloneEvent(
                payload.eventIdentifier, // Source Event ID
                constants.STAKEHOLDERS_FORM_URL, // URL of form to trigger
                false, // Don't need conference bridge details
                null, // Don't need conference bridgeNumber
                [{"id":"jolin|Work Email", "recipientType": "DEVICE"}], // Specific recipients (optional)
                [{"sourcePropertyName": "Prop1", "targetPropertyName": "prop2"}, // Property map (optional)
                 {"sourcePropertyName": "prop2", "targetPropertyName": "Prop1"}],
                null // (optioanl) No additional properties needed at this time
                );
            if (null === response) {
                console.log('response returned null after calling cloneEvent.');
            } else {
                console.log('response after calling cloneEvent: ' + JSON.stringify(response, null, 4));
            }
        }
        break;
    
    // Any other response
    default:
        console.log('Unknown response option.');
        break;
}
