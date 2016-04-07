/*global logger*/
/*
    SelectionHelper
    ========================

    @file      : SelectionHelper.js
    @version   : 1.0
    @author    : Eric Tieniber
    @date      : Wed, 06 Apr 2016 16:22:55 GMT
    @copyright : 
    @license   : Apache2

    Documentation
    ========================
    Describe your widget here.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",

    "mxui/dom",
    "dojo/dom",
    "dojo/dom-prop",
    "dojo/dom-geometry",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "dojo/html",
    "dojo/_base/event",

    "SelectionHelper/lib/jquery-1.11.2",
], function(declare, _WidgetBase, dom, dojoDom, dojoProp, dojoGeometry, dojoClass, dojoStyle, dojoConstruct, dojoArray, dojoLang, dojoText, dojoHtml, dojoEvent, _jQuery) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    // Declare widget's prototype.
    return declare("SelectionHelper.widget.SelectionHelper", [ _WidgetBase ], {

        // DOM elements
        inputNodes: null,
        colorSelectNode: null,
        colorInputNode: null,
        infoTextNode: null,
		

        // Parameters configured in the Modeler.
        dataSourceMF: null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _alertDiv: null,
		_observer: null,
		_domToClick: null,
		_guidToSelect: null,
		_runOnce: false,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {
            // Uncomment the following line to enable debug messages
            //logger.level(logger.DEBUG);
            logger.debug(this.id + ".constructor");
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function() {
            logger.debug(this.id + ".postCreate");
            this._updateRendering();
            this._setupEvents();
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function(obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
            this._resetSubscriptions();
            this._updateRendering();
			
			this._prepClick();
            callback();
        },

        // mxui.widget._WidgetBase.enable is called when the widget should enable editing. Implement to enable editing if widget is input widget.
        enable: function() {
          logger.debug(this.id + ".enable");
        },

        // mxui.widget._WidgetBase.enable is called when the widget should disable editing. Implement to disable editing if widget is input widget.
        disable: function() {
          logger.debug(this.id + ".disable");
        },

        // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
        resize: function(box) {
          logger.debug(this.id + ".resize");
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function() {
          logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
			if(this._observer) {
				this._observer.disconnect();
				this._observer = null;
			}
        },
		
		_prepClick: function() {
			if (this.dataSourceMF) {
					this._callMF();
				} else {			
					this._guidToSelect = this._contextObj.getGuid();
					this._setupMutationObserver(this.domNode.previousSibling, this._findSelection);
				}
		},

		_callMF: function() {
			mx.data.action({
				params: {
					applyto: "selection",
					actionname: this.dataSourceMF,
					guids: [this._contextObj.getGuid()]
				},
				store: {
					caller: this.mxform
				},
				callback: dojoLang.hitch(this, function (obj) {
					this._guidToSelect = obj[0].getGuid();
					this._findSelection();
				}),
				error: dojoLang.hitch(this, function (error) {
					console.log(this.id + ": An error occurred while executing microflow: " + error.description);
				})
			}, this);	
		},
		
		//List for changes to the DOM so we know when data is available.
		_setupMutationObserver: function (node, callback) {
			MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

			this._observer = new MutationObserver(dojoLang.hitch(this, callback));

			// define what element should be observed by the observer
			// and what types of mutations trigger the callback
			this._observer.observe(node, {
				subtree: true,
				childList: true,
				attributes: false,
				characterData: false,
				attributeOldValue: false,
				characterDataOldValue: false
			});
		},
		
		_findSelection: function() {
			//Find the list view
			var prevSib = this.domNode.previousSibling;
			var widget = dijit.registry.byNode(prevSib);
			
			var itemList = [];
			
			if (widget.declaredClass == "mxui.widget.TemplateGrid") {
				itemList = widget._itemCache;
			} else if (widget.declaredClass == "mxui.widget.ListView") {
				itemList = widget._itemList;
			} else if (widget.declaredClass == "mxui.widget.DataGrid") {
				for(var i=0; i<widget._mxObjects.length; i++) {
					itemList[i] = {domNode: widget._gridRowNodes[i], mxcontext: {trackId: widget._mxObjects[i]._guid}};	
				}
			}
			
			if (itemList.length > 0) {
				for(var i=0; i<itemList.length; i++) {
        			if (itemList[i].mxcontext.trackId == this._guidToSelect) {
						var thisItemDom = itemList[i].domNode;
						
						//TODO: find another way without the setTimeout: We can't click right away or the listening DV doesn't see it for some reason
						//thisItemDom.click();
						if (widget.declaredClass == "mxui.widget.ListView" && !this._runOnce) {
							thisItemDom.click();
							setTimeout(function() {thisItemDom.click()},200);
						} else {
							thisItemDom.click();
						}
						//turn off the mutation listener
						if(this._observer) {
							this._observer.disconnect();
							this._observer = null;
						}
						this._runOnce = true;
						break;
					}
    			}
			} else if (!this._observer) {
			//List is empty, so if we don't have a mutation observer, set one up
				this._setupMutationObserver(this.domNode.previousSibling, this._findSelection);
			}
		},
		
        // Attach events to HTML dom elements
        _setupEvents: function() {
            logger.debug(this.id + "._setupEvents");
        },

        // Rerender the interface.
        _updateRendering: function() {
            logger.debug(this.id + "._updateRendering");
			
        },

        // Handle validations.
        _handleValidation: function(validations) {
            logger.debug(this.id + "._handleValidation");
        },

        // Reset subscriptions.
		_resetSubscriptions: function() {		
            logger.debug(this.id + "._resetSubscriptions");
            // Release handles on previous object, if any.
            if (this._handles) {
                dojoArray.forEach(this._handles, function (handle) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }

            // When a mendix object exists create subscribtions.
            if (this._contextObj) {
                var objectHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function(guid) {
                        this._prepClick();
                    })
                });
	
                this._handles = [ objectHandle];
            }
        }
    });
});

require(["SelectionHelper/widget/SelectionHelper"], function() {
    "use strict";
});