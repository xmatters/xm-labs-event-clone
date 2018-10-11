# Event Clone
This repository contains a Shared Library and a template/example Communications Plan to make it easier to spawn a new Event based on an Existing event with a single function call.
The setup is fairly simple, and the Shared Library may be used in any number of Communication Plans.

<kbd>
  <img src="https://github.com/xmatters/xMatters-Labs/raw/master/media/disclaimer.png">
</kbd>

# Pre-Requisites
* xMatters account - If you don't have one, [get one](https://www.xmatters.com)!

# Files
* [Clone_Util.js](Clone_Util.js) - This is the JavaScript source file for the "Clone Util" Shared Library.<br>You can copy and paste that as a Shared Library into any existing or new Communication Plan with the name "Clone Util".
* [OutboundIntegration-NotificationResponses.js](OutboundIntegration-NotificationResponses.js) - An example Outbound Integration triggered by `Notification Response` and may be associated with whatever Form you have created to trigger a follow-up Inbound Integration based on a response (e.g. "inform" in this example).<br>You may use this as an example of how to use the Shared Library.
* [EmergencyChangePlaybookCloneUtilExample.zip](EmergencyChangePlaybookCloneUtilExample.zip) - This example Communication Plan is a derivative/based on the [Emergency Change Playbook](https://support.xmatters.com/hc/en-us/articles/360001906232) (available on the xMatters Community site [here](https://support.xmatters.com/hc/en-us/articles/360001906232)) and has a couple of Outbound Notifications that show how to use the [Clone Util](Clone_Util.js) Shared Library.

# How it works
There are several exposed utility functions available in `Clone Util`:<br>

1. `cloneEvent` - Looksup the details of the given Event (via eventId) and clones the properties and fires off another event.<br>
<pre>cloneEvent = function(
    eventId,             // eventId to use as the source for Properties and other metadata
    targetURL,           // URL of form to trigger
    includeConfDetails,  // If true will copy the Conference Call details.
    isDynamicBridge,     // (Optional) If specified, and the source event uses a non-xMatters (EXTERNAL) conference bridge
    recipients,          // (Optional) Recipients to target.  If null or undefined then don't explicitly target anyone.
    propertyMatcher,     // (Optional) Array of simple property matching objects of "sourcePropertyName" and "targetPropertyName"
    additionalProperties // (Optional) Additional properties that will be added to the target payload.
    )</pre>
Detailed Argument Description:<br>
`eventId`: {number} eventId to use as the source for Properties and other metadata.<br>
`targetURL`: {String} URL of form to trigger.<br>
`includeConfDetails`: {boolean} If true will copy the Conference Call details.  Expects that the target Form has a  Conference stanza, otherwise a run-time error may occur.<br>
`isDynamicBridge`: {boolean} (Optional) If specified, and the source event uses a non-xMatters (EXTERNAL) conference bridge, this value determines whether or not the source event's conference bridge uses a static or dynamically defined bridge number.<br>If true, than the EXTERNAL bridge has a dynamically defined bridge number.  In that case, the bridgeNumber value must be carried over to the new form if third artument is true.<br>If false, or undefined, than the assumption is that the EXTERNAL bridge has a statically specified bridge number.  In that case, the bridgeNumber must not be specified, or a runtime error will occur.
`recipeints`: {object}\[] (Optional) Recipients to target.  If null or undefined then don't explicitly target anyone.<br>
The format should follow that as defined for the POST /events call (see the docs [here](https://help.xmatters.com/xmapi/index.html?javascript#trigger-an-event))<br>e.g.<br><pre>[
{"id":"mmcbride", "recipientType": "PERSON"},
{"id":"Executives", "recipientType": "GROUP"}
]</pre>
`propertyMatcher`: {object}\[] (Optional) Array of simple property matching objects of "sourcePropertyName" and "targetPropertyName"<br>e.g.<br><pre>[
{"sourcePropertyName": "subject", "targetPropertyName": "Description"},
{"sourcePropertyName": "ticketNumber", "targetPropertyName": "Incident ID"},
{"sourcePropertyName": "impactedSystem", "targetPropertyName": "CI"}
]</pre>
`additionalProperties`: {object} (Optional) Additional properties that will be added to the target payload.<br>Note: These will overwrite any properties with the same name in the properties coming from the source event.<br>e.g.<br><pre>
{
"Other Prop1": "Some value",
"Other Prop2": "A different value"
}</pre>
`@returns`: {Object} The Response object from POSTing the request, or null if other errors.
`@usage`: Example of using this in an Outbound Integration - Notification Response trigger<br><pre>
console.log('Entered Outbound Integration: "Notification Responses"');<br>
// Load shared libraries
<b>var clone = require('Clone Util');</b><br>
// Parse and fixup the inbound payload
var payload = JSON.parse(request.body);
<b>clone.fixPayload(payload);</b><br>
// Take an action based on the first word of the response
var response = payload.response.toLowerCase().split(" ")[0];
switch (response) {<br>
        // If "inform" then clone the form and send to stakeholders
        case "inform": {
            <b>var response = clone.cloneEvent(
                payload.eventIdentifier, // Source Event ID
                constants.STAKEHOLDERS_FORM_URL, // URL of form to trigger
                false, // Don't need conference bridge details
                null, // Don't need conference bridgeNumber
                [{"id":"jolin|Work Email", "recipientType": "DEVICE"}], // Specific recipients (optional)
                [{"sourcePropertyName": "Prop1", "targetPropertyName": "prop2"}, // Property map (optional)
                 {"sourcePropertyName": "prop2", "targetPropertyName": "Prop1"}],
                null // Not adding any additional properties at this time.
                );</b>
            if (null === response) {
                console.log('response returned null after calling util.cloneEvent.');
            } else {
                console.log('response after calling util.cloneEvent: ' + JSON.stringify(response, null, 4));
            }
        }
        break;<br>
        // Any other response
        default:
            console.log('Unknown response option.');
        break;
    }</pre>
2. `getEvent` - Retrieves the xMatters event object via it's event id.<br>
<pre>getEvent = function(
eventId //{string|number} Event identifier to find
)<br>
returns: {object} The event object.<br>Returns null if not found, or an error was returned. </pre>
3. `triggerEvent` - Triggers a new event using the specified URL and trigger object.<br><pre>triggerEvent = function(
targetURL, // {String} URL of form to trigger.
trigger    // {object} Properly formatted Trigger object
                  See [Trigger an Event](https://help.xmatters.com/xmapi/index.html?javascript#trigger-an-event) in the online xM API help for details.
)<br>
returns: {object} The Response object from POSTing the request<br>Returns null if other errors.</pre>
4. `fixPayload` - Transform the eventProperties object that is part of the payload included in an Outbound Integration script so that you can access included Form properties using dot notation.<br><pre>fixPayload = function(
payload // {object} payload object from an Outbound Integration
)</pre>
5. `isValidStatusCode` - Determine if an HTTP status code represents success (is between 200 and 299).<br><pre>isValidStatusCode = function(<br>statusCode // {number} statusCode from an HTTP response<br>)<br>
returns: {boolean} true if successful; false otherwise</pre>
6. `callxMatters` - Calls xMatters based on the input parameters.<br>In the case of a failure (5xx) or exception, will retry up to 2 additional times (default).<br><pre>callxMatters = function(
method,        // {string} the HTTP method to call
path,          // {string} path to make call against
autoEncodeURI, // {boolean} whether or not to auto Encode the URI
payload        // {object} [Optional] the properties/payload object
                      to send with POST or PUT
)<br>
returns: {object} the Response object</pre>
 

# Installation
Installation is simple.<br>
You can either [import](https://help.xmatters.com/ondemand/xmodwelcome/communicationplanbuilder/exportcommplan.htm) the [Emergency Change Playbook](EmergencyChangePlaybookCloneUtilExample.zip) with the `Clone Util` Library already installed.<br>
Or you can add a [Shared Library](https://help.xmatters.com/ondemand/xmodwelcome/integrationbuilder/shared-libraries.htm) to an existing Communication Plan using the [Clone_Util.js](Clone_Util.js),<br>
and create your own [Outbound Integration](https://help.xmatters.com/ondemand/xmodwelcome/integrationbuilder/example-outbound-updates.htm) using the [OutboundIntegration-NotificationResponses.js](OutboundIntegration-NotificationResponses.js) as a starting point.<br>
If you are going to try using the included [Emergency Change Playbook](EmergencyChangePlaybookCloneUtilExample.zip) Sample Communication Plan, you will want to review the configuration guide [here](https://support.xmatters.com/hc/en-us/articles/360001906232).


# Testing
The easiest way to exercise the Shared Library is via installing the Sample Communication Plan and send yourself an Emergency Change Request.  When you choose the "Inform..." option, it will call the Notification Response Outbound Integration.  Use the Activity Stream to see what's happening at run-time.  

# Troubleshooting
If you're having problems, check the Activity Stream of the Outbound Integration.<br>
