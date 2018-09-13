/*global logger,dojo*/
/*jslint nomen: true*/
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

    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/dom-class",

], function(declare, _WidgetBase, dojoArray, dojoLang, domClass) {
    "use strict";

    // Declare widget's prototype.
    return declare("SelectionHelper.widget.SelectionHelper", [ _WidgetBase ], {


        // Parameters configured in the Modeler.
        listEntity: "",
		dataSourceMF: "",
		dataSourceListMF: "",
        listenRef: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _alertDiv: null,
		_observer: null,
		_domToClick: null,
		//_guidToSelect: null,
		_runOnce: false,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {
            // Uncomment the following line to enable debug messages
            //logger.level(logger.DEBUG);
            logger.debug(this.id + ".constructor");
            this._handles = [];
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function(obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
            this._resetSubscriptions();

			this._prepClick();
            callback();
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
			if (this.dataSourceListMF) {
					this._callListMF();
			} else if (this.dataSourceMF) {
					this._callMF();
            } else if (this.listenRef) {
                    this._setSelectionFromReference();
			} else {
				//this._guidToSelect = this._contextObj.getGuid();
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
				origin: this.mxform,
				callback: dojoLang.hitch(this, function (objs) {
					//this._guidToSelect = objs[0].getGuid();
					this._findSelection(null, null, objs);
				}),
				error: dojoLang.hitch(this, function (error) {
					console.log(this.id + ": An error occurred while executing microflow: " + error.description);
				})
			}, this);
		},

		_callListMF: function() {
			mx.data.action({
				params: {
					applyto: "selection",
					actionname: this.dataSourceListMF,
					guids: [this._contextObj.getGuid()]
				},
				store: {
					caller: this.mxform
				},
				callback: dojoLang.hitch(this, function (objs) {
					//this._guidToSelect = objs[0].getGuid();
					this._findSelection(null, null, objs);
				}),
				error: dojoLang.hitch(this, function (error) {
					console.log(this.id + ": An error occurred while executing microflow: " + error.description);
				})
			}, this);
		},

        _setSelectionFromReference: function() {
            var refGuid = this._contextObj.get(this.listenRef.split("/")[0]);
            this._findSelection(null, null, null, [refGuid]);
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

		_findSelection: function(mutations, mutationObserver, objs, guids) {
            var guidsToSelect = [];
            if (guids) {
                guidsToSelect = guids;
            } else {
                if(objs == null) {
    				objs = [this._contextObj];
    			} else {
                    for (var i=0; i<objs.length; i++) {
        				guidsToSelect.push(objs[i].getGuid());
        			}
                }
            }

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
        			if (dojoArray.indexOf(guidsToSelect, itemList[i].mxcontext.trackId) >= 0) {
						var thisItemDom = itemList[i].domNode;

						//TODO: find another way without the setTimeout: We can't click right away or the listening DV doesn't see it for some reason
						//thisItemDom.click();
						if (widget.declaredClass == "mxui.widget.ListView" && !this._runOnce) {
							thisItemDom.click();
							setTimeout(function() {thisItemDom.click()},200);
						} else if (widget.declaredClass === "mxui.widget.TemplateGrid") {
							widget.selectRow(thisItemDom);
							widget._addToSelection(itemList[i].mxcontext.trackId);
						} else {
                            if(!domClass.contains(thisItemDom, "selected")) {
                                thisItemDom.click();
                            }
						}
						//turn off the mutation listener
						if(this._observer) {
							this._observer.disconnect();
							this._observer = null;
						}
						//this._runOnce = true;
						//break;
					}
    			}
			} else if (!this._observer) {
			//List is empty, so if we don't have a mutation observer, set one up
				this._setupMutationObserver(this.domNode.previousSibling, this._findSelection);
			}
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

                this._handles.push(objectHandle);
            }

            if (this._contextObj && this.listenRef) {
                var refHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.listenRef.split("/")[0],
                    callback: dojoLang.hitch(this, function(guid) {
                        this._setSelectionFromReference();
                    })
                });

                this._handles.push(refHandle);
            }
        }
    });
});

require(["SelectionHelper/widget/SelectionHelper"], function() {
    "use strict";
});
