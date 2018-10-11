# Event Clone
This repository contains a Shared Library and a template/example Communications Plan to make it easier to spawn a new Event based on an Existing event with a single function call.
The setup is fairly simple, and the Shared Library may be used in any number of Communication Plans.

<kbd>
  <img src="https://github.com/xmatters/xMatters-Labs/raw/master/media/disclaimer.png">
</kbd>

# Pre-Requisites
* xMatters account - If you don't have one, [get one](https://www.xmatters.com)!

# Files
* [Clone_Util.js](Clone_Util.js) - This is the JavaScript source file for the "Clone Util" Shared Library.
You can copy and paste that as a Shared Library into any existing or new Communication Plan with the name "Clone Util".
* [OutboundIntegration-NotificationResponses.js](OutboundIntegration-NotificationResponses.js) - An example Outbound Integration triggered by `Notification Response` and may be associated with whatever Form you have created to trigger a follow-up Inbound Integration based on a response (e.g. "inform" in this example).<br>You may use this as an example of how to use the Shared Library.
* [EmergencyChangePlaybookCloneUtilExample.zip](EmergencyChangePlaybookCloneUtilExample.zip) - This example Communication Plan is a derivative/based on the [Emergency Change Playbook](https://support.xmatters.com/hc/en-us/articles/360001906232) (available on the xMatters Community site [here](https://support.xmatters.com/hc/en-us/articles/360001906232)) and has a couple of Outbound Notifications that show how to use the [Clone Util](Clone_Util.js) Shared Library.

# How it works
There are several exposed utility functions available in `Clone Util`:

1. `cloneEvent` - Looksup the details of the given Event (via eventId) and clones the properties and fires off another event.

   ```javascript
cloneEvent = function(
        eventId,             // eventId to use as the source for Properties and other metadata
        targetURL,           // URL of form to trigger
        includeConfDetails,  // If true will copy the Conference Call details.
        isDynamicBridge,     // [Optional] If specified, and the source event uses a non-xMatters, EXTERNAL, conference bridge
        recipients,          // [Optional] Recipients to target.  If null or undefined then do not explicitly target anyone.
        propertyMatcher,     // [Optional] Array of simple property matching objects of "sourcePropertyName" and "targetPropertyName"
        additionalProperties // [Optional] Additional properties to be added to the target payload.
        )
   ```

   **cloneEvent() Detailed Argument Description:**
   

   `eventId`: {number} eventId to use as the source for Properties and other metadata.

   `targetURL`: {String} URL of form to trigger.

   `includeConfDetails`: {boolean} If `true` will copy the Conference Call details.  Expects that the target Form has a  Conference stanza, otherwise a run-time error may occur.

   `isDynamicBridge`: {boolean} [Optional] If specified, and the source event uses a non-xMatters (EXTERNAL) conference bridge, this value determines whether or not the source event's conference bridge uses a static or dynamically defined bridge number.
   If *_true_*, than the EXTERNAL bridge has a dynamically defined bridge number.  In that case, the bridgeNumber value must be carried over to the new form if third artument is true.
   If *_false_*, or *_undefined_*, than the assumption is that the EXTERNAL bridge has a statically specified bridge number.  In that case, the bridgeNumber must not be specified, or a runtime error will occur.

   `recipeints`: {object}\[] [Optional] Recipients to target.  If null or undefined then don't explicitly target anyone. The format should follow that as defined for the POST /events call (see the docs [here](https://help.xmatters.com/xmapi/index.html?javascript#trigger-an-event))
   e.g.
   
   ```javascript
[
{"id":"mmcbride", "recipientType": "PERSON"},
{"id":"Executives", "recipientType": "GROUP"}
]
   ```

   `propertyMatcher`: {object}\[] (Optional) Array of simple property matching objects of "sourcePropertyName" and "targetPropertyName"<br>
   e.g.

   ```javascript
[
{"sourcePropertyName": "subject", "targetPropertyName": "Description"},
{"sourcePropertyName": "ticketNumber", "targetPropertyName": "Incident ID"},
{"sourcePropertyName": "impactedSystem", "targetPropertyName": "CI"}
]
   ```

   `additionalProperties`: {object} (Optional) Additional properties that will be added to the target payload.
   Note: These will overwrite any properties with the same name in the properties coming from the source event.
   e.g.
   
   ```javascript
{
"Other Prop1": "Some value",
"Other Prop2": "A different value"
}
   ```

   `returns`: {Object} The Response object from POSTing the request, or null if other errors.
   
   `usage`: Example of using this in an Outbound Integration - Notification Response trigger

```javascript
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
				null // Not adding any additional properties at this time.
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
```
2. `getEvent` - Retrieves the xMatters event object via it's event id.
```javascript
	getEvent = function(
		eventId //{string|number} Event identifier to find
	)
	returns: {object} The event object.<br>Returns null if not found, or an error was returned.
```
3. `triggerEvent` - Triggers a new event using the specified URL and trigger object.
```javascript
    triggerEvent = function(
        targetURL, // {String} URL of form to trigger.
        trigger    // {object} Properly formatted Trigger object 
    )
    returns: {object} The Response object from POSTing the request<br>Returns null if other errors.
```
See [Trigger an Event](https://help.xmatters.com/xmapi/index.html?javascript#trigger-an-event) in the online xM API help for details.<br>
4. `fixPayload` - Transform the eventProperties object that is part of the payload included in an Outbound Integration script so that you can access included Form properties using dot notation.
```javascript
    fixPayload = function(
        payload // {object} payload object from an Outbound Integration
    )
```
5. `isValidStatusCode` - Determine if an HTTP status code represents success (is between 200 and 299).
```javascript
    isValidStatusCode = function(
        statusCode // {number} statusCode from an HTTP response
    )
    returns: {boolean} true if successful; false otherwise
```
6. `callxMatters` - Calls xMatters based on the input parameters.<br>In the case of a failure (5xx) or exception, will retry up to 2 additional times (default).
```javascript
	callxMatters = function(
		method,        // {string} the HTTP method to call
		path,          // {string} path to make call against
		autoEncodeURI, // {boolean} whether or not to auto Encode the URI
		payload        // {object} [Optional] the properties to send with POST or PUT
	)
	returns: {object} the Response object
``` 

# Installation
Installation is simple.
You can either [import](https://help.xmatters.com/ondemand/xmodwelcome/communicationplanbuilder/exportcommplan.htm) the [Emergency Change Playbook](EmergencyChangePlaybookCloneUtilExample.zip) with the `Clone Util` Library already installed.
Or you can add a [Shared Library](https://help.xmatters.com/ondemand/xmodwelcome/integrationbuilder/shared-libraries.htm) to an existing Communication Plan using the [Clone_Util.js](Clone_Util.js),
and create your own [Outbound Integration](https://help.xmatters.com/ondemand/xmodwelcome/integrationbuilder/example-outbound-updates.htm) using the [OutboundIntegration-NotificationResponses.js](OutboundIntegration-NotificationResponses.js) as a starting point.
If you are going to try using the included [Emergency Change Playbook](EmergencyChangePlaybookCloneUtilExample.zip) Sample Communication Plan, you will want to review the configuration guide [here](https://support.xmatters.com/hc/en-us/articles/360001906232).


# Testing
The easiest way to exercise the Shared Library is via installing the Sample Communication Plan and send yourself an Emergency Change Request.  When you choose the "Inform..." option, it will call the Notification Response Outbound Integration.  Use the Activity Stream to see what's happening at run-time.  

# Troubleshooting
If you're having problems, check the Activity Stream of the Outbound Integration.<br>
