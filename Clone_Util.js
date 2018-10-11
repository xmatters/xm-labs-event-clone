/**
 * ---------------------------------------------------------------------------------------------------------------------
 * 
 * Shared library containing utility functions for duplicating events
 *
 * To use this shared library in another script, include the following 
 * 'require' function statement in your Integration Builder script.
 *
 *  var clone = require('Clone Util');
 *  clone.fixPayload(payload);
 *  var results = cloneEvent(payload.eventIdentifier,targetURL,false);
 *
 * Required Constants (to be defined in the "requiring" Comm Plan)
 *   None.
 * 
 * Required Shared Libraries (to be included in this Comm Plan):
 *   None.
 *
 * Hisory
 *  Version: 1.0 (2018-10-11)
 *
 * ---------------------------------------------------------------------------------------------------------------------
 */


/**
 * ---------------------------------------------------------------------------------------------------------------------
 * 
 * Looksup the details of the given Event (via eventId) and clones the properties and fires off another event.
 * 
 * @param {number} eventId to use as the source for Properties and other metadata
 * @param {String} URL of form to trigger.
 * @param {boolean} If true will copy the Conference Call details.  
 *      Expects that the target Form has a  Conference stanza, otherwise a run-time error may occur.
 * @param {boolean} (Optional) If specified, and the source event uses a non-xMatters (EXTERNAL) conference bridge,
 *      this value determines whether or not the source event's conference bridge uses a static or dynamically
 *      defined bridge number.  
 *      If true, than the EXTERNAL bridge has a dynamically defined bridge number.  In that case, the bridgeNumber value
 *          must be carried over to the new form if third artument is true.
 *      If false, or undefined, than the assumption is that the EXTERNAL bridge has a statically specified bridge number.
 *          In that case, the bridgeNumber must not be specified, or a runtime error will occur.
 * @param {object}[] (Optional) Recipients to target.  If null or undefined then don't explicitly target anyone.
 *      The format should follow that as defined for the POST /events call
 *      (see https://help.xmatters.com/xmapi/index.html?javascript#trigger-an-event)
 *      e.g. 
 *          [
 *              {"id":"mmcbride", "recipientType": "PERSON"},
 *              {"id":"Executives", "recipientType": "GROUP"}
 *          ]          
 * @param {object}[] (Optional) Array of simple property matching objects of "sourcePropertyName" and "targetPropertyName"
 *      e.g. 
 *          [
 *              {"sourcePropertyName": "subject", "targetPropertyName": "Description"},
 *              {"sourcePropertyName": "ticketNumber", "targetPropertyName": "Incident ID"},
 *              {"sourcePropertyName": "impactedSystem", "targetPropertyName": "CI"}
 *          ]
 * @param {object} (Optional) Additional properties that will be added to the target payload.
 *      Note: These will overwrite any properties with the same name in the properties coming from the source event.
 *      e.g.
 *          {
 *              "Other Prop1": "Some value",
 *              "Other Prop2": "A different value"
 *          }
 * 
 * @returns {Object} The Response object from POSTing the request, or null if other errors.
 * 
 * @usage Example of using this in an Outbound Integration - Notification Response trigger
 * 
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
                        console.log('response returned null after calling util.cloneEvent.');
                    } else {
                        console.log('response after calling util.cloneEvent: ' + JSON.stringify(response, null, 4));
                    }
                }
                break;
            
            // Any other response
            default:
                console.log('Unknown response option.');
                break;
        }
 * ---------------------------------------------------------------------------------------------------------------------
 */
var cloneEvent = function(
    eventId,             // eventId to use as the source for Properties and other metadata
    targetURL,           // URL of form to trigger
    includeConfDetails,  // If true will copy the Conference Call details.
    isDynamicBridge,     // (Optional) If specified, and the source event uses a non-xMatters (EXTERNAL) conference bridge
    recipients,          // (Optional) Recipients to target.  If null or undefined then don't explicitly target anyone.
    propertyMatcher,     // (Optional) Array of simple property matching objects of "sourcePropertyName" and "targetPropertyName"
    additionalProperties // (Optional) Additional properties that will be added to the target payload.
    ) {
        
    var funcName = "cloneEvent";
    var result = null;
    
    // 1. Validate the required inputs (need an event ID, a target URL, and an indicator regarding conf. bridge info)
    if ((typeof eventId !== "number") || (eventId === null) || (eventId <= 0)) {
        console.log(funcName + " - !!! FATAL !!! - eventId is not an number, is null, or not > 0.");        
        return result;
    } else if ((typeof targetURL !== "string") || (targetURL.length === 0)) {
        console.log(funcName + " - !!! FATAL !!! - targetURL is not a string or empty.");        
        return result;
    } else if ((typeof includeConfDetails !== "boolean") || (includeConfDetails === null)) {
        console.log(funcName + " - !!! FATAL !!! - includeConfDetails is not a boolean, or is null.");        
        return result;
    }
    
    // 2. First get the details from the event in question
    var event = getEvent(eventId);
    if (null !== event) {
        
        // 3. Create trigger object and populate properties
        var trigger = {};
        trigger.properties = {};
        
        // 4. Fixup any property names that have language suffix
        //    (e.g. subject#en should be referenced as just subject in the new plan.)
        var evProps = {};
        for (var ep in event.properties) {
            if ((ep.length > 3) && (ep.charAt(ep.length-3) === '#')) {
                evProps[ep.substring(0,ep.length-3)] = event.properties[ep];
            } else {
                evProps[ep] = event.properties[ep];
            }
        }
        
        // 5. If propertyMatcher exists, use that to determine which values get used in the subsequent call
        if ((typeof propertyMatcher === "object") && (null !== propertyMatcher) && Array.isArray(propertyMatcher) && (propertyMatcher.length > 0)) {
            for (var i in propertyMatcher) {
                // make sure that the name map exists
                if ((typeof propertyMatcher[i].sourcePropertyName === "string" && propertyMatcher[i].sourcePropertyName.length > 0) &&
                    (typeof propertyMatcher[i].targetPropertyName === "string" && propertyMatcher[i].targetPropertyName.length > 0)) {
                    if (typeof evProps[propertyMatcher[i].sourcePropertyName] === undefined) {
                        console.log(funcName + ' - "' + propertyMatcher[i].sourcePropertyName + '" was not found in the source Event\'s properties at element " + (i+1) + " of the propertyMatcher array.  Skipping property.');
                    } else {
                        // Fill the target property from the existing property's value.
                        trigger.properties[propertyMatcher[i].targetPropertyName] = evProps[propertyMatcher[i].sourcePropertyName];
                    }
                } else {
                    console.log(funcName + " - sourcePropertyName or targetPropertyName are missing or empty at element " + (i+1) + " of the propertyMatcher array.");
                }
            }
        } else {
            trigger.properties = evProps;
        }
        
        // 6. If additionalProperties exists, add those to the trigger's properties object.
        if ((typeof additionalProperties === "object") && (null !== additionalProperties)) {
            for (var ap in additionalProperties) {
                trigger.properties[ap] = additionalProperties[ap];
            }
        }
        
        // 7. Copy the conference details if requested.
        if (includeConfDetails) {
            if ((typeof event.conference === "object") && (event.conference !== null)) {
                var conference = {};
                conference.type = event.conference.type;
                if ("EXTERNAL" === event.conference.type) {
                    conference.bridgeId = event.conference.bridgeId;
                    if ((typeof isDynamicBridge === "boolean") && (isDynamicBridge !== null) && isDynamicBridge) {
                        conference.bridgeNumber = event.conference.bridgeNumber;
                    }
                } else { // is BRIDGE
                    conference.bridgeId = event.conference.bridgeId;
                    conference.bridgeNumber = event.conference.bridgeNumber;
                }
                trigger.conference = conference;
            } else {
                console.log(funcName + " - Conference details were requested, but the source Event does not contain any Conference details.");
            }
        }

        // 8. Set the recipients, if supplied
        if ((typeof recipients === "object") && (null !== recipients) && Array.isArray(recipients) && (recipients.length > 0)) {
            trigger.recipients = recipients;
        }
        
        // 9. Grab the metadata from the source event (only priority for now, add others as you neee)
        trigger.priority = event.priority;
        
        // 10. Trigger the event.
        result = triggerEvent(targetURL, trigger);
    }
    
    return result;
};
exports.cloneEvent = cloneEvent;


/**
 * ---------------------------------------------------------------------------------------------------------------------
 * 
 * Retrieves the xMatters event object via it's event id
 * 
 * @param {string|number} Event identifier to find
 * 
 * @returns {object} The event object.  Returns null if not found, or an error was returned.
 * 
 * ---------------------------------------------------------------------------------------------------------------------
 */
var getEvent = function(eventId) {
    // Make the request to get the events
    var response = callxMatters(
        'GET',
        '/api/xm/1/events/' + eventId
        );
    if(isValidStatusCode(response.statusCode)) {
        var event = null;
        if(response.body) {
            event = JSON.parse(response.body);
        } 
        return event;
    } else {
        console.log('util.getEvents returned an error: ' + response.statusCode);
        return null;
    }
};
exports.getEvent = getEvent;


/**
 * ---------------------------------------------------------------------------------------------------------------------
 * 
 * Triggers a new event using the specified URL and trigger object
 * 
 * @param {String} URL of form to trigger.
 * @param {object} Properly formatted Trigger object
 *      See https://help.xmatters.com/xmapi/index.html?javascript#trigger-an-event
 * 
 * @returns {Object} The Response object from POSTing the request, or null if other errors.
 * 
 * ---------------------------------------------------------------------------------------------------------------------
 */
var triggerEvent = function(targetURL, trigger) {
    var funcName = "triggerEvent";
    var result = null;
    
    // 1. Validate the required inputs (need a target URL, and a trigger object)
    if ((typeof targetURL !== "string") || (targetURL.length === 0)) {
        console.log(funcName + " - !!! FATAL !!! - targetURL is not a string or empty.");        
        return result;
    } else if ((typeof trigger !== "object") || (trigger === null)) {
        console.log(funcName + " - !!! FATAL !!! - trigger is not an object, or is null.");        
        return result;
    }
    
    // 2. Trigger the event.
    result = callxMatters('POST', targetURL, true /* autoEncode */, trigger);

    return result;
};
exports.triggerEvent = triggerEvent;


/**
 * ---------------------------------------------------------------------------------------------------------------------
 * 
 * Form properties are included in the payload when they are marked as
 * 'Include in Outbound Integrations' on the form layout.
 *
 * Transform the eventProperties object so that
 * you can access form properties using dot notation.
 * 
 * @param {object} payload object from an Outbound Integration
 * 
 * ---------------------------------------------------------------------------------------------------------------------
 */
var fixPayload = function(payload) {
    if (payload.eventProperties && Array.isArray(payload.eventProperties)) {
        var eventProperties = payload.eventProperties;
        payload.eventProperties = {};
    
        for (var i = 0; i < eventProperties.length; i++) {
            var eventProperty = eventProperties[i];
            var key = Object.keys(eventProperty)[0];
            payload.eventProperties[key] = eventProperty[key];
          }
    }
};
exports.fixPayload = fixPayload;


/**
 * ---------------------------------------------------------------------------------------------------------------------
 * 
 * Determine if an HTTP status code represents success
 *
 * @param {number} statusCode from an HTTP request
 * @returns {boolean} true if successful; false otherwise
 * 
 * ---------------------------------------------------------------------------------------------------------------------
 */
var isValidStatusCode = function(statusCode) {
    return statusCode >= 200 && statusCode <= 299;
};
exports.isValidStatusCode = isValidStatusCode;


/**
 * ---------------------------------------------------------------------------------------------------------------------
 * 
 * Calls xMatters based on the input parameters.  
 * In the case of a failure (5xx) or exception, will retry up to 2 additional times (default)
 * 
 * @param {string} the HTTP method to call
 * @param {string} path to make call against
 * @param {boolean} whether or not to auto Encode the URI
 * @param {object} [Optional] the properties/payload object to send with POST or PUT
 * 
 * @returns {object} the Response object
 * 
 * ---------------------------------------------------------------------------------------------------------------------
 */
var callxMatters = function(method, path, autoEncodeURI, payload) {
    var funcName = "util.callxMatters";
    console.log("Enter " + funcName + " - method: " + method + ", path: " + path);
    var maxRetries = 2;
    
	// Check to see if the path starts with a FQDN, if so, trim it
	var sPath = path.split( /xmatters.com/ );
	if( sPath.length === 2 ) {
		path = sPath[1];
	}

    // Prepare the request object to get the Incident
    var requestObj = {
        'endpoint': "xMatters",
        'path': path,
        'method': method,
        'headers': {
            'Content-Type': 'application/json'
        }
    };
    
    // Check for and add autoEncodeURI if not true
    // Note, the defauolt is true
    if ((typeof autoEncodeURI === "boolean") && (null !== autoEncodeURI) && !autoEncodeURI) {
        requestObj.autoEncodeURI = autoEncodeURI;
    }

    // Create the request
    var request = http.request(requestObj);

    // Send request to xMatters with retries
    var response;
    var finished = false;
    for (var retryCount = 0;!finished || (retryCount === maxRetries);++retryCount) {
        console.log('util.callxMatters - Attempt #' + (retryCount+1));
        try {
            if ((typeof payload === "object") && (null !== payload)) {
                response = request.write(payload);
            } else {
                response = request.write();
            }
            if (response.statusCode < 500) {
                finished = true;
            }
        } catch (e) {
            response = {};
            response.statusCode = 400;
            errBody = {
                "code":400,
                "message": String(e),
                "reason":"Exception",
                "subcode":"Exception caught in util." + funcName
            };
            response.body = JSON.stringify(errBody);
        }
    }

    console.log("Exit " + funcName + " - response: " + JSON.stringify(response));
    return response;   
};
exports.callxMatters = callxMatters;
