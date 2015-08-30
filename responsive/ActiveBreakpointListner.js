/**
 * @author Swagatam Mitra
  
 */

define(function (require, exports, module) {
    "use strict";
    
    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
    var MODULE_PATH = ExtensionUtils.getModulePath(module);
    var RuleSetCreator = require("stylemodule/RuleSetCreator");
    var randomColor = require("lib/randomcolor/randomColor");
    
    var maxMediaTemplate = '<div style="background:url({{@module}}images/ruler_min.png) 100% 50% no-repeat {{@color}};height:100%;width:{{@mediaparam}};text-align:right;color:white;position:absolute;"></div>';
    var minMediaTemplate = '<div style="background:url({{@module}}images/ruler_min.png) 100% 50% no-repeat {{@color}};height:100%;width:calc(100% - {{@mediaparam}});text-align:left;color:white;position:absolute;"></div>';
    
    var RE_MEDIA_QUERY     = /^(?:(only|not)?\s*([_a-z][_a-z0-9-]*)|(\([^\)]+\)))(?:\s*and\s*(.*))?$/i,
        RE_MQ_EXPRESSION   = /^\(\s*([_a-z-][_a-z0-9-]*)\s*(?:\:\s*([^\)]+))?\s*\)$/,
        RE_MQ_FEATURE      = /^(?:(min|max)-)?(.+)/,
        RE_LENGTH_UNIT     = /(em|rem|px|cm|mm|in|pt|pc)?\s*$/,
        RE_RESOLUTION_UNIT = /(dpi|dpcm|dppx)?\s*$/;
    
    var currentStyleSheets = [];
    var definedMedia = [];
    var activeMedia = null;
    var mediaList = null;
    
    $(document).on("stylesheets-in-dom","#html-design-editor",function(event, styleSheets){
        currentStyleSheets = document.getElementById('htmldesignerIframe').contentWindow.document.styleSheets;
        _findMediaRules();
    });
    
    $(document).on("click","#designer-add-media-breakpoint",function(event){
        var mediaFilter = $("#design-window-width-input").val()+'px';
        mediaFilter = '@media screen and (max-width: '+mediaFilter+'){ //inserted by html designer }';
        RuleSetCreator.createNewMediaRule(mediaFilter,0);
        currentStyleSheets = document.getElementById('htmldesignerIframe').contentWindow.document.styleSheets;
        _findMediaRules();
        
    });
    
    
    function _findMediaRules(){
        $("#breakpoint-container").html("");
        definedMedia = [];
        mediaList = [];
        var sheetCount, setCount, styleSheet, ruleSets, ruleSet, mediaCount;
        var ref,entry;
        for (sheetCount = 0; sheetCount < currentStyleSheets.length && !ref; sheetCount++) {
            styleSheet = currentStyleSheets[sheetCount];
            ruleSets = styleSheet.rules;
            for (setCount = 0; setCount < ruleSets.length && !ref; setCount++) {
                ruleSet = ruleSets[setCount];
                if (ruleSet.media) {
                    for(mediaCount = 0;mediaCount < ruleSet.media.length;mediaCount++){
                        definedMedia.push(parseQuery(ruleSet.media[mediaCount]));
                        entry = [];
                        entry.push(ruleSet.media[mediaCount]);
                        entry.push(ruleSet);
                        mediaList.push(entry);
                    }
                }
            }
            $("#breakpoint-container").html("");
            for(mediaCount = 0;mediaCount < definedMedia.length ;mediaCount++){
                if(definedMedia[mediaCount][0].expressions[0] && definedMedia[mediaCount][0].expressions[0].feature === 'width'){
                    _appendMediaIndicator(definedMedia[mediaCount][0].expressions[0].modifier,definedMedia[mediaCount][0].expressions[0].value);
                }
            }
        }
        _findAppliedMedia();
    }
    
    function _findAppliedMedia() {
        var asynchPromise = new $.Deferred();
        var width = parseInt($("#designer-content-placeholder").css('width'));
        var mediaCount,mediaFound = false;
        var appliedMedia;
        for(mediaCount = definedMedia.length - 1;mediaCount >=0 && !mediaFound ;mediaCount--){
            if(definedMedia[mediaCount][0].expressions[0] && definedMedia[mediaCount][0].expressions[0].feature === 'width'){
                switch(definedMedia[mediaCount][0].expressions[0].modifier){
                    case 'min': 
                            mediaFound = width >= parseInt(definedMedia[mediaCount][0].expressions[0].value);
                            appliedMedia = mediaList[mediaCount];
                            break;
                    case 'max':
                            mediaFound = width <= parseInt(definedMedia[mediaCount][0].expressions[0].value);
                            appliedMedia = mediaList[mediaCount];
                            break;
                }
            }
        }
        if(mediaFound){
            $(".active-Media-applied").text(appliedMedia[0]);
        } else {
            $(".active-Media-applied").text("No Active Media");
        }
        
        $("#html-design-editor").trigger("activemedia-found",[mediaFound ? appliedMedia[0] : null]);
        
        asynchPromise.resolve();
        return asynchPromise.promise();
    }
        
    
    $(document).on("panelResizeUpdate", "#designer-content-placeholder", _findAppliedMedia);
                    
    function _appendMediaIndicator(modifier,value){
        var templ = maxMediaTemplate.split("{{@module}}").join(MODULE_PATH);
        var color = randomColor({
                       luminosity: 'bright',
                       format: 'rgbArray' 
                    });
            color = "rgba("+color[0]+","+color[1]+","+color[2]+",0.7)";
        switch(modifier){
            case 'min':templ = templ.split("{{@color}}").join(color).split("{{@mediaparam}}").join(value); 
                        $(templ).appendTo("#breakpoint-container").css('left',value).text(value);
                        break;
            case 'max': templ = templ.split("{{@color}}").join(color).split("{{@mediaparam}}").join(value);
                        $(templ).appendTo("#breakpoint-container").css('left',"0px").text(value);
                        break
        }
    }
    
    function parseQuery(mediaQuery) {
        return mediaQuery.split(',').map(function (query) {
            query = query.trim();

            var captures = query.match(RE_MEDIA_QUERY);

            // Media Query must be valid.
            if (!captures) {
                throw new SyntaxError('Invalid CSS media query: "' + query + '"');
            }

            var modifier    = captures[1],
                type        = captures[2],
                expressions = ((captures[3] || '') + (captures[4] || '')).trim(),
                parsed      = {};

            parsed.inverse = !!modifier && modifier.toLowerCase() === 'not';
            parsed.type    = type ? type.toLowerCase() : 'all';

            // Check for media query expressions.
            if (!expressions) {
                parsed.expressions = [];
                return parsed;
            }

            // Split expressions into a list.
            expressions = expressions.match(/\([^\)]+\)/g);

            // Media Query must be valid.
            if (!expressions) {
                throw new SyntaxError('Invalid CSS media query: "' + query + '"');
            }

            parsed.expressions = expressions.map(function (expression) {
                var captures = expression.match(RE_MQ_EXPRESSION);

                // Media Query must be valid.
                if (!captures) {
                    throw new SyntaxError('Invalid CSS media query: "' + query + '"');
                }

                var feature = captures[1].toLowerCase().match(RE_MQ_FEATURE);

                return {
                    modifier: feature[1],
                    feature : feature[2],
                    value   : captures[2]
                };
            });

            return parsed;
        });
    }
   
});