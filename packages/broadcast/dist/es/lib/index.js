/**
 * @author AILHC 505126057@qq.com
 */
var Broadcast = /** @class */ (function () {
    function Broadcast() {
        this.keys = new Proxy({}, {
            get: function (target, p) {
                return p;
            }
        });
        this._valueMap = {};
        this._unuseHandlers = [];
    }
    //注册
    /**
     * 注册事件，可以注册多个
     * @param key 事件名
     * @param listener 监听回调
     * @param context 上下文
     * @param args 透传参数
     * @param once 是否监听一次
     *
     */
    Broadcast.prototype.on = function (handler, listener, context, once, args) {
        if (typeof handler === "string") {
            if (!listener)
                return;
            this._addHandler(this._getHandler(handler, listener, context, once, args));
        }
        else {
            if (this._isArr(handler)) {
                var handlers = handler;
                for (var i = 0; i < handlers.length; i++) {
                    this._addHandler(handlers[i]);
                }
            }
            else {
                this._addHandler(handler);
            }
        }
    };
    Broadcast.prototype.has = function (key) {
        return this._handlerMap && !!this._handlerMap[key];
    };
    Broadcast.prototype.offAllByContext = function (context) {
        var handlerMap = this._handlerMap;
        if (context && handlerMap) {
            for (var key in handlerMap) {
                if (handlerMap[key]) {
                    this.off(key, null, context);
                }
            }
        }
    };
    /**
     * 注销指定事件的所有监听
     * @param key
     */
    Broadcast.prototype.offAll = function (key) {
        if (this._isStringNull(key)) {
            return;
        }
        var handlerMap = this._handlerMap;
        var stickyMap = this._stickHandlersMap;
        var valueMap = this._valueMap;
        if (stickyMap)
            stickyMap[key] = undefined;
        if (handlerMap) {
            var handlers = handlerMap[key];
            if (this._isArr(handlers)) {
                for (var i = 0; i < handlers.length; i++) {
                    this._recoverHandler(handlers[i]);
                }
            }
            else {
                this._recoverHandler(handlers);
            }
            handlerMap[key] = undefined;
        }
        if (valueMap)
            valueMap[key] = undefined;
    };
    Broadcast.prototype.off = function (key, listener, context, onceOnly) {
        if (this._isStringNull(key))
            return;
        var handlerMap = this._handlerMap;
        if (!handlerMap || !handlerMap[key])
            return this;
        var handler = handlerMap[key];
        if (handler !== undefined && handler !== null) {
            var handlers = void 0;
            if (!this._isArr(handler)) {
                if ((!context || handler.context === context)
                    && (listener == null || handler.listener === listener)
                    && (!onceOnly || handler.once)) {
                    this._recoverHandler(handler);
                    handlerMap[key] = undefined;
                }
            }
            else {
                handlers = handler;
                //倒序遍历做删除,将要删除的移到末尾，pop出去，时间复杂度O(1)
                var endIndex = handlers.length - 1;
                for (var i = endIndex; i >= 0; i--) {
                    handler = handlers[i];
                    if (handler && (!context || handler.context === context)
                        && (listener == null || handler.listener === listener)
                        && (!onceOnly || handler.once)) {
                        endIndex = handlers.length - 1;
                        if (i !== endIndex) {
                            handler = handlers[endIndex];
                            handlers[endIndex] = handlers[i];
                            handlers[i] = handler;
                        }
                        this._recoverHandler(handlers.pop());
                    }
                }
                if (!handlers.length) {
                    handlerMap[key] = undefined;
                }
                // let count: number = 0;
                // for (let i: number = 0; i < handlers.length; i++) {
                //     const item: IListenerHandler<KeyType> = handlers[i];
                //     if (!item) {
                //         count++;
                //         continue;
                //     }
                //     if (item && (!context || item.context === context)
                //         && (listener == null || item.listener === listener)
                //         && (!onceOnly || item.once)) {
                //         count++;
                //         handlers[i] = undefined;
                //     }
                // }
                // //如果全部移除，则删除索引
                // if (count === handlers.length) {
                //     handlerMap[key] = undefined;
                // } else {
                //     const newHandlers: IListenerHandler<KeyType>[] = [];
                //     for (let i = 0; i < handlers.length; i++) {
                //         handlers[i] && newHandlers.push(handlers[i]);
                //     }
                //     handlerMap[key] = newHandlers;
                // }
            }
        }
        return this;
    };
    //广播
    /**
     * 广播
     * @param key 事件名
     * @param value 数据
     * @param callback 回调
     * @param persistence 是否持久化数据
     */
    Broadcast.prototype.broadcast = function (key, value, callback, persistence) {
        var handlerMap = this._handlerMap;
        if (!handlerMap)
            return;
        var handlers = handlerMap[key];
        if (persistence) {
            var valueMap = this._valueMap;
            if (!valueMap) {
                valueMap = {};
                this._valueMap = valueMap;
            }
            valueMap[key] = value;
        }
        if (!handlers)
            return;
        if (!this._isArr(handlers)) {
            var handler = handlers;
            value ? Broadcast._runHandlerWithData(handler, value, callback) : Broadcast._runHandler(handler, callback);
            if (handler.once) {
                this._recoverHandler(handler);
                this._handlerMap[key] = undefined;
            }
        }
        else {
            var handlerArr = handlers;
            var handler = void 0;
            var endIndex = handlerArr.length - 1;
            for (var i = endIndex; i >= 0; i--) {
                handler = handlerArr[i];
                value ? Broadcast._runHandlerWithData(handler, value, callback) : Broadcast._runHandler(handler, callback);
                if (handler.once) {
                    endIndex = handlerArr.length - 1;
                    handler = handlerArr[endIndex];
                    handlerArr[endIndex] = handlerArr[i];
                    handlerArr[i] = handler;
                    this._recoverHandler(handlerArr.pop());
                }
            }
            if (!handlerArr.length) {
                this._handlerMap[key] = undefined;
            }
        }
    };
    /**
     * 广播一条 指定 [key] 的粘性消息
     * 如果广播系统中没有注册该类型的接收者，本条信息将被滞留在系统中。一旦有该类型接收者被注册，本条消息将会被立即发送给接收者
     * 如果系统中已经注册有该类型的接收者，本条消息将会被立即发送给接收者。
     *
     * @param key 消息类型
     * @param value 消息携带的数据。可以是任意类型或是null
     * @param callback 能够收到接收器返回的消息
     * @param persistence 是否持久化消息类型。持久化的消息可以在任意时刻通过 broadcast.value(key) 获取当前消息的数据包。默认情况下，未持久化的消息类型在没有接收者的时候会被移除，而持久化的消息类型则不会。开发者可以通过 [clear] 函数来移除持久化的消息类型。
     */
    Broadcast.prototype.stickyBroadcast = function (key, value, callback, persistence) {
        if (this._isStringNull(key))
            return;
        var handlerMap = this._handlerMap;
        if (handlerMap && handlerMap[key]) {
            this.broadcast(key, value, callback, persistence);
        }
        else {
            var stickyMap = this._stickHandlersMap;
            if (!stickyMap) {
                stickyMap = {};
                this._stickHandlersMap = stickyMap;
            }
            var stickyHandlers = stickyMap[key];
            var handler = {
                key: key,
                value: value,
                callback: callback,
                persistence: persistence
            };
            if (!stickyHandlers) {
                stickyMap[key] = [handler];
            }
            else {
                stickyHandlers.push(handler);
            }
        }
    };
    /**
     * 字符串是否为空 undefined null ""
     * @param str
     */
    Broadcast.prototype._isStringNull = function (str) {
        return !str || str.trim() === "";
    };
    /**
     * 是否是数组
     * @param target
     */
    Broadcast.prototype._isArr = function (target) {
        return Object.prototype.toString.call(target) === "[object Array]";
    };
    /**
     * 将广播的数据作为参数，执行广播监听器的逻辑
     * @param handler 广播监听器
     * @param data 广播的消息数据
     */
    Broadcast._runHandlerWithData = function (handler, data, callback) {
        if (handler.listener == null)
            return null;
        var result;
        if (data == null) {
            var args = handler.args ? handler.args.unshift(callback) : [callback];
            result = handler.listener.apply(handler.context, args);
        }
        else if (!handler.args && !data.unshift)
            result = handler.listener.apply(handler.context, [data, callback]);
        else if (handler.args)
            result = handler.listener.apply(handler.context, [data, callback].concat(handler.args));
        else
            result = handler.listener.apply(handler.context, [data, callback]);
        return result;
    };
    /**
     * 执行广播监听者的逻辑
     * @param handler
     */
    Broadcast._runHandler = function (handler, callback) {
        if (handler.listener == null)
            return null;
        var args = handler.args ? handler.args.unshift(callback) : [callback];
        var result = handler.listener.apply(handler.context, args);
        return result;
    };
    /**
     * 回收handler
     * @param handler
     */
    Broadcast.prototype._recoverHandler = function (handler) {
        handler.args = undefined;
        handler.context = undefined;
        handler.listener = undefined;
        handler.key = undefined;
        this._unuseHandlers.push(handler);
    };
    /**
     * 获取handler
     * @param key
     * @param listener
     * @param context
     * @param once
     * @param args
     */
    Broadcast.prototype._getHandler = function (key, listener, context, once, args) {
        var unuseHandlers = this._unuseHandlers;
        var handler;
        if (unuseHandlers.length) {
            handler = unuseHandlers.pop();
        }
        else {
            handler = {};
        }
        handler.key = key;
        handler.listener = listener;
        handler.context = context;
        handler.once = once;
        handler.args = args;
        return handler;
    };
    /**
     * 添加广播监听
     * 如果是监听1次，则会移除上一次相同的监听
     * 会判断是否有粘性广播，如果有就会触发广播
     * @param handler
     */
    Broadcast.prototype._addHandler = function (handler) {
        var handlerMap = this._handlerMap;
        if (handler.once) {
            this.off(handler.key, handler.listener, handler.context, handler.once);
        }
        if (!handlerMap) {
            handlerMap = {};
            this._handlerMap = handlerMap;
        }
        var events = handlerMap[handler.key];
        if (events) {
            if (this._isArr(events)) {
                events.push(handler);
            }
            else {
                handlerMap[handler.key] = [events, handler];
            }
        }
        else {
            handlerMap[handler.key] = handler;
        }
        var stickyMap = this._stickHandlersMap;
        if (stickyMap) {
            var stickyHandlers = stickyMap[handler.key];
            if (stickyHandlers) {
                var handler_1;
                for (var i = 0; i < stickyHandlers.length; i++) {
                    handler_1 = stickyHandlers[i];
                    this.broadcast(handler_1.key, handler_1.value, handler_1.callback, handler_1.persistence);
                }
                stickyMap[handler_1.key] = undefined;
            }
        }
        if (handler.key !== this.keys.onListenerOn) {
            this.broadcast(this.keys.onListenerOn, handler.key);
        }
    };
    /**
     * 取值
     * @param key
     */
    Broadcast.prototype.value = function (key) {
        return this._valueMap && this._valueMap[key];
    };
    /**
     * 销毁广播系统
     */
    Broadcast.prototype.dispose = function () {
        this._handlerMap = undefined;
        this._stickHandlersMap = undefined;
        this._valueMap = undefined;
    };
    return Broadcast;
}());

export { Broadcast };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9icm9hZGNhc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiXHJcbi8qKlxyXG4gKiBAYXV0aG9yIEFJTEhDIDUwNTEyNjA1N0BxcS5jb21cclxuICovXHJcbmV4cG9ydCBjbGFzcyBCcm9hZGNhc3Q8TXNnS2V5VHlwZSBleHRlbmRzIGJyb2FkY2FzdC5JTXNnS2V5LCBWYWx1ZVR5cGUgPSBhbnksIFJlc3VsdFR5cGUgPSBhbnk+XHJcbiAgICBpbXBsZW1lbnRzIGJyb2FkY2FzdC5JQnJvYWRjYXN0PE1zZ0tleVR5cGUsIFZhbHVlVHlwZSwgUmVzdWx0VHlwZT57XHJcblxyXG4gICAgcHVibGljIGtleXM6IHsgW2tleSBpbiBrZXlvZiBNc2dLZXlUeXBlXTogTXNnS2V5VHlwZVtrZXldIH07XHJcbiAgICBwcml2YXRlIF92YWx1ZU1hcDogeyBba2V5IGluIGtleW9mIE1zZ0tleVR5cGVdOiBhbnkgfTtcclxuICAgIHByaXZhdGUgX2hhbmRsZXJNYXA6IHsgW2tleSBpbiBrZXlvZiBNc2dLZXlUeXBlXTogYnJvYWRjYXN0LklMaXN0ZW5lckhhbmRsZXIgfCBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcltdIH07XHJcbiAgICBwcml2YXRlIF9zdGlja0hhbmRsZXJzTWFwOiB7IFtrZXkgaW4ga2V5b2YgTXNnS2V5VHlwZV06IGJyb2FkY2FzdC5JU3RpY2t5SGFuZGxlcltdIH07XHJcbiAgICBwcm90ZWN0ZWQgX3VudXNlSGFuZGxlcnM6IGFueVtdXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmtleXMgPSBuZXcgUHJveHkoe30gYXMgYW55LCB7XHJcbiAgICAgICAgICAgIGdldDogKHRhcmdldCwgcCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KVxyXG4gICAgICAgIHRoaXMuX3ZhbHVlTWFwID0ge30gYXMgYW55O1xyXG4gICAgICAgIHRoaXMuX3VudXNlSGFuZGxlcnMgPSBbXTtcclxuICAgIH1cclxuICAgIC8v5rOo5YaMXHJcbiAgICAvKipcclxuICAgICAqIOazqOWGjOS6i+S7tu+8jOWPr+S7peazqOWGjOWkmuS4qlxyXG4gICAgICogQHBhcmFtIGtleSDkuovku7blkI1cclxuICAgICAqIEBwYXJhbSBsaXN0ZW5lciDnm5HlkKzlm57osINcclxuICAgICAqIEBwYXJhbSBjb250ZXh0IOS4iuS4i+aWh1xyXG4gICAgICogQHBhcmFtIGFyZ3Mg6YCP5Lyg5Y+C5pWwXHJcbiAgICAgKiBAcGFyYW0gb25jZSDmmK/lkKbnm5HlkKzkuIDmrKFcclxuICAgICAqIFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb248a2V5VHlwZSBleHRlbmRzIGtleW9mIE1zZ0tleVR5cGUgPSBhbnk+KFxyXG4gICAgICAgIGhhbmRsZXI6IGtleVR5cGUgfCBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcjxrZXlUeXBlLCBWYWx1ZVR5cGUsIFJlc3VsdFR5cGU+IHwgYnJvYWRjYXN0LklMaXN0ZW5lckhhbmRsZXI8a2V5VHlwZSwgVmFsdWVUeXBlLCBSZXN1bHRUeXBlPltdLFxyXG4gICAgICAgIGxpc3RlbmVyPzogYnJvYWRjYXN0Lkxpc3RlbmVyPFZhbHVlVHlwZVticm9hZGNhc3QuVG9BbnlJbmRleEtleTxrZXlUeXBlLCBWYWx1ZVR5cGU+XSwgUmVzdWx0VHlwZVticm9hZGNhc3QuVG9BbnlJbmRleEtleTxrZXlUeXBlLCBSZXN1bHRUeXBlPl0+LFxyXG4gICAgICAgIGNvbnRleHQ/OiBhbnksXHJcbiAgICAgICAgb25jZT86IGJvb2xlYW4sXHJcbiAgICAgICAgYXJncz86IGFueVtdXHJcbiAgICApIHtcclxuICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgaWYgKCFsaXN0ZW5lcikgcmV0dXJuO1xyXG4gICAgICAgICAgICB0aGlzLl9hZGRIYW5kbGVyKHRoaXMuX2dldEhhbmRsZXIoaGFuZGxlciwgbGlzdGVuZXIsIGNvbnRleHQsIG9uY2UsIGFyZ3MpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNBcnIoaGFuZGxlcikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXJzOiBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcltdID0gaGFuZGxlciBhcyBhbnk7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGhhbmRsZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWRkSGFuZGxlcihoYW5kbGVyc1tpXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRIYW5kbGVyKGhhbmRsZXIgYXMgYW55KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcbiAgICBwdWJsaWMgaGFzKGtleToga2V5b2YgTXNnS2V5VHlwZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9oYW5kbGVyTWFwICYmICEhdGhpcy5faGFuZGxlck1hcFtrZXldXHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIG9mZkFsbEJ5Q29udGV4dChjb250ZXh0OiBhbnkpIHtcclxuICAgICAgICBjb25zdCBoYW5kbGVyTWFwID0gdGhpcy5faGFuZGxlck1hcDtcclxuICAgICAgICBpZiAoY29udGV4dCAmJiBoYW5kbGVyTWFwKSB7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGhhbmRsZXJNYXApIHtcclxuICAgICAgICAgICAgICAgIGlmIChoYW5kbGVyTWFwW2tleV0pIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9mZihrZXksIG51bGwsIGNvbnRleHQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICog5rOo6ZSA5oyH5a6a5LqL5Lu255qE5omA5pyJ55uR5ZCsXHJcbiAgICAgKiBAcGFyYW0ga2V5IFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb2ZmQWxsKGtleT86IGtleW9mIE1zZ0tleVR5cGUpIHtcclxuICAgICAgICBpZiAodGhpcy5faXNTdHJpbmdOdWxsKGtleSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBoYW5kbGVyTWFwID0gdGhpcy5faGFuZGxlck1hcDtcclxuICAgICAgICBjb25zdCBzdGlja3lNYXAgPSB0aGlzLl9zdGlja0hhbmRsZXJzTWFwO1xyXG4gICAgICAgIGNvbnN0IHZhbHVlTWFwID0gdGhpcy5fdmFsdWVNYXA7XHJcbiAgICAgICAgaWYgKHN0aWNreU1hcCkgc3RpY2t5TWFwW2tleV0gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKGhhbmRsZXJNYXApIHtcclxuICAgICAgICAgICAgY29uc3QgaGFuZGxlcnM6IGJyb2FkY2FzdC5JTGlzdGVuZXJIYW5kbGVyW10gPSBoYW5kbGVyTWFwW2tleV0gYXMgYW55O1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNBcnIoaGFuZGxlcnMpKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGhhbmRsZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVjb3ZlckhhbmRsZXIoaGFuZGxlcnNbaV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcmVjb3ZlckhhbmRsZXIoaGFuZGxlcnMgYXMgYW55KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBoYW5kbGVyTWFwW2tleV0gPSB1bmRlZmluZWRcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHZhbHVlTWFwKSB2YWx1ZU1hcFtrZXldID0gdW5kZWZpbmVkO1xyXG5cclxuICAgIH1cclxuICAgIHB1YmxpYyBvZmYoa2V5OiBrZXlvZiBNc2dLZXlUeXBlLCBsaXN0ZW5lcjogYnJvYWRjYXN0Lkxpc3RlbmVyLCBjb250ZXh0PzogYW55LCBvbmNlT25seT86IGJvb2xlYW4pIHtcclxuICAgICAgICBpZiAodGhpcy5faXNTdHJpbmdOdWxsKGtleSkpIHJldHVybjtcclxuICAgICAgICBjb25zdCBoYW5kbGVyTWFwID0gdGhpcy5faGFuZGxlck1hcDtcclxuICAgICAgICBpZiAoIWhhbmRsZXJNYXAgfHwgIWhhbmRsZXJNYXBba2V5XSkgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgbGV0IGhhbmRsZXI6IGJyb2FkY2FzdC5JTGlzdGVuZXJIYW5kbGVyID0gaGFuZGxlck1hcFtrZXldIGFzIGFueTtcclxuICAgICAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkICYmIGhhbmRsZXIgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgbGV0IGhhbmRsZXJzOiBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcltdO1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX2lzQXJyKGhhbmRsZXIpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoKCFjb250ZXh0IHx8IGhhbmRsZXIuY29udGV4dCA9PT0gY29udGV4dClcclxuICAgICAgICAgICAgICAgICAgICAmJiAobGlzdGVuZXIgPT0gbnVsbCB8fCBoYW5kbGVyLmxpc3RlbmVyID09PSBsaXN0ZW5lcilcclxuICAgICAgICAgICAgICAgICAgICAmJiAoIW9uY2VPbmx5IHx8IGhhbmRsZXIub25jZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWNvdmVySGFuZGxlcihoYW5kbGVyKTtcclxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyTWFwW2tleV0gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVycyA9IGhhbmRsZXIgYXMgYW55O1xyXG4gICAgICAgICAgICAgICAgLy/lgJLluo/pgY3ljoblgZrliKDpmaQs5bCG6KaB5Yig6Zmk55qE56e75Yiw5pyr5bC+77yMcG9w5Ye65Y6777yM5pe26Ze05aSN5p2C5bqmTygxKVxyXG4gICAgICAgICAgICAgICAgbGV0IGVuZEluZGV4ID0gaGFuZGxlcnMubGVuZ3RoIC0gMTtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSBlbmRJbmRleDsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyID0gaGFuZGxlcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhbmRsZXIgJiYgKCFjb250ZXh0IHx8IGhhbmRsZXIuY29udGV4dCA9PT0gY29udGV4dClcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKGxpc3RlbmVyID09IG51bGwgfHwgaGFuZGxlci5saXN0ZW5lciA9PT0gbGlzdGVuZXIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICYmICghb25jZU9ubHkgfHwgaGFuZGxlci5vbmNlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmRJbmRleCA9IGhhbmRsZXJzLmxlbmd0aCAtIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpICE9PSBlbmRJbmRleCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlciA9IGhhbmRsZXJzW2VuZEluZGV4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXJzW2VuZEluZGV4XSA9IGhhbmRsZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcnNbaV0gPSBoYW5kbGVyO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlY292ZXJIYW5kbGVyKGhhbmRsZXJzLnBvcCgpKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCFoYW5kbGVycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyTWFwW2tleV0gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAvLyBsZXQgY291bnQ6IG51bWJlciA9IDA7XHJcbiAgICAgICAgICAgICAgICAvLyBmb3IgKGxldCBpOiBudW1iZXIgPSAwOyBpIDwgaGFuZGxlcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdCBpdGVtOiBJTGlzdGVuZXJIYW5kbGVyPEtleVR5cGU+ID0gaGFuZGxlcnNbaV07XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgaWYgKCFpdGVtKSB7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgIGNvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIH1cclxuICAgICAgICAgICAgICAgIC8vICAgICBpZiAoaXRlbSAmJiAoIWNvbnRleHQgfHwgaXRlbS5jb250ZXh0ID09PSBjb250ZXh0KVxyXG4gICAgICAgICAgICAgICAgLy8gICAgICAgICAmJiAobGlzdGVuZXIgPT0gbnVsbCB8fCBpdGVtLmxpc3RlbmVyID09PSBsaXN0ZW5lcilcclxuICAgICAgICAgICAgICAgIC8vICAgICAgICAgJiYgKCFvbmNlT25seSB8fCBpdGVtLm9uY2UpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgIGNvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgIGhhbmRsZXJzW2ldID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIH1cclxuICAgICAgICAgICAgICAgIC8vIH1cclxuICAgICAgICAgICAgICAgIC8vIC8v5aaC5p6c5YWo6YOo56e76Zmk77yM5YiZ5Yig6Zmk57Si5byVXHJcbiAgICAgICAgICAgICAgICAvLyBpZiAoY291bnQgPT09IGhhbmRsZXJzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIGhhbmRsZXJNYXBba2V5XSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgIC8vIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgY29uc3QgbmV3SGFuZGxlcnM6IElMaXN0ZW5lckhhbmRsZXI8S2V5VHlwZT5bXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaGFuZGxlcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIC8vICAgICAgICAgaGFuZGxlcnNbaV0gJiYgbmV3SGFuZGxlcnMucHVzaChoYW5kbGVyc1tpXSk7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgfVxyXG4gICAgICAgICAgICAgICAgLy8gICAgIGhhbmRsZXJNYXBba2V5XSA9IG5ld0hhbmRsZXJzO1xyXG4gICAgICAgICAgICAgICAgLy8gfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuICAgIC8v5bm/5pKtXHJcbiAgICAvKipcclxuICAgICAqIOW5v+aSrVxyXG4gICAgICogQHBhcmFtIGtleSDkuovku7blkI1cclxuICAgICAqIEBwYXJhbSB2YWx1ZSDmlbDmja5cclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osINcclxuICAgICAqIEBwYXJhbSBwZXJzaXN0ZW5jZSDmmK/lkKbmjIHkuYXljJbmlbDmja5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGJyb2FkY2FzdDxrZXlUeXBlIGV4dGVuZHMga2V5b2YgTXNnS2V5VHlwZSA9IGFueT4oXHJcbiAgICAgICAga2V5OiBrZXlUeXBlLCB2YWx1ZT86IFZhbHVlVHlwZVticm9hZGNhc3QuVG9BbnlJbmRleEtleTxrZXlUeXBlLCBWYWx1ZVR5cGU+XSxcclxuICAgICAgICBjYWxsYmFjaz86IGJyb2FkY2FzdC5SZXN1bHRDYWxsQmFjazxSZXN1bHRUeXBlW2Jyb2FkY2FzdC5Ub0FueUluZGV4S2V5PGtleVR5cGUsIFJlc3VsdFR5cGU+XT4sXHJcbiAgICAgICAgcGVyc2lzdGVuY2U/OiBib29sZWFuKSB7XHJcbiAgICAgICAgY29uc3QgaGFuZGxlck1hcCA9IHRoaXMuX2hhbmRsZXJNYXA7XHJcbiAgICAgICAgaWYgKCFoYW5kbGVyTWFwKSByZXR1cm47XHJcbiAgICAgICAgY29uc3QgaGFuZGxlcnMgPSBoYW5kbGVyTWFwW2tleV07XHJcbiAgICAgICAgaWYgKHBlcnNpc3RlbmNlKSB7XHJcbiAgICAgICAgICAgIGxldCB2YWx1ZU1hcCA9IHRoaXMuX3ZhbHVlTWFwO1xyXG4gICAgICAgICAgICBpZiAoIXZhbHVlTWFwKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZU1hcCA9IHt9IGFzIGFueTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3ZhbHVlTWFwID0gdmFsdWVNYXA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFsdWVNYXBba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWhhbmRsZXJzKSByZXR1cm47XHJcbiAgICAgICAgaWYgKCF0aGlzLl9pc0FycihoYW5kbGVycykpIHtcclxuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IGhhbmRsZXJzIGFzIGJyb2FkY2FzdC5JTGlzdGVuZXJIYW5kbGVyO1xyXG4gICAgICAgICAgICB2YWx1ZSA/IEJyb2FkY2FzdC5fcnVuSGFuZGxlcldpdGhEYXRhKGhhbmRsZXIsIHZhbHVlLCBjYWxsYmFjaykgOiBCcm9hZGNhc3QuX3J1bkhhbmRsZXIoaGFuZGxlciwgY2FsbGJhY2spO1xyXG4gICAgICAgICAgICBpZiAoaGFuZGxlci5vbmNlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWNvdmVySGFuZGxlcihoYW5kbGVyKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2hhbmRsZXJNYXBba2V5XSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXJBcnIgPSBoYW5kbGVycyBhcyBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcltdO1xyXG4gICAgICAgICAgICBsZXQgaGFuZGxlcjogYnJvYWRjYXN0LklMaXN0ZW5lckhhbmRsZXI7XHJcbiAgICAgICAgICAgIGxldCBlbmRJbmRleCA9IGhhbmRsZXJBcnIubGVuZ3RoIC0gMTtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IGVuZEluZGV4OyBpID49IDA7IGktLSkge1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlciA9IGhhbmRsZXJBcnJbaV07XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA/IEJyb2FkY2FzdC5fcnVuSGFuZGxlcldpdGhEYXRhKGhhbmRsZXIsIHZhbHVlLCBjYWxsYmFjaykgOiBCcm9hZGNhc3QuX3J1bkhhbmRsZXIoaGFuZGxlciwgY2FsbGJhY2spO1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhbmRsZXIub25jZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGVuZEluZGV4ID0gaGFuZGxlckFyci5sZW5ndGggLSAxO1xyXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBoYW5kbGVyQXJyW2VuZEluZGV4XTtcclxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyQXJyW2VuZEluZGV4XSA9IGhhbmRsZXJBcnJbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlckFycltpXSA9IGhhbmRsZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVjb3ZlckhhbmRsZXIoaGFuZGxlckFyci5wb3AoKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFoYW5kbGVyQXJyLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5faGFuZGxlck1hcFtrZXldID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiDlub/mkq3kuIDmnaEg5oyH5a6aIFtrZXldIOeahOeymOaAp+a2iOaBr1xyXG4gICAgICog5aaC5p6c5bm/5pKt57O757uf5Lit5rKh5pyJ5rOo5YaM6K+l57G75Z6L55qE5o6l5pS26ICF77yM5pys5p2h5L+h5oGv5bCG6KKr5rue55WZ5Zyo57O757uf5Lit44CC5LiA5pem5pyJ6K+l57G75Z6L5o6l5pS26ICF6KKr5rOo5YaM77yM5pys5p2h5raI5oGv5bCG5Lya6KKr56uL5Y2z5Y+R6YCB57uZ5o6l5pS26ICFXHJcbiAgICAgKiDlpoLmnpzns7vnu5/kuK3lt7Lnu4/ms6jlhozmnInor6XnsbvlnovnmoTmjqXmlLbogIXvvIzmnKzmnaHmtojmga/lsIbkvJrooqvnq4vljbPlj5HpgIHnu5nmjqXmlLbogIXjgIJcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIGtleSDmtojmga/nsbvlnotcclxuICAgICAqIEBwYXJhbSB2YWx1ZSDmtojmga/mkLrluKbnmoTmlbDmja7jgILlj6/ku6XmmK/ku7vmhI/nsbvlnovmiJbmmK9udWxsXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg6IO95aSf5pS25Yiw5o6l5pS25Zmo6L+U5Zue55qE5raI5oGvXHJcbiAgICAgKiBAcGFyYW0gcGVyc2lzdGVuY2Ug5piv5ZCm5oyB5LmF5YyW5raI5oGv57G75Z6L44CC5oyB5LmF5YyW55qE5raI5oGv5Y+v5Lul5Zyo5Lu75oSP5pe25Yi76YCa6L+HIGJyb2FkY2FzdC52YWx1ZShrZXkpIOiOt+WPluW9k+WJjea2iOaBr+eahOaVsOaNruWMheOAgum7mOiupOaDheWGteS4i++8jOacquaMgeS5heWMlueahOa2iOaBr+exu+Wei+WcqOayoeacieaOpeaUtuiAheeahOaXtuWAmeS8muiiq+enu+mZpO+8jOiAjOaMgeS5heWMlueahOa2iOaBr+exu+Wei+WImeS4jeS8muOAguW8gOWPkeiAheWPr+S7pemAmui/hyBbY2xlYXJdIOWHveaVsOadpeenu+mZpOaMgeS5heWMlueahOa2iOaBr+exu+Wei+OAglxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RpY2t5QnJvYWRjYXN0PGtleVR5cGUgZXh0ZW5kcyBrZXlvZiBNc2dLZXlUeXBlID0gYW55PihcclxuICAgICAgICBrZXk6IGtleVR5cGUsXHJcbiAgICAgICAgdmFsdWU/OiBWYWx1ZVR5cGVbYnJvYWRjYXN0LlRvQW55SW5kZXhLZXk8a2V5VHlwZSwgVmFsdWVUeXBlPl0sXHJcbiAgICAgICAgY2FsbGJhY2s/OiBicm9hZGNhc3QuUmVzdWx0Q2FsbEJhY2s8UmVzdWx0VHlwZVticm9hZGNhc3QuVG9BbnlJbmRleEtleTxrZXlUeXBlLCBSZXN1bHRUeXBlPl0+LFxyXG4gICAgICAgIHBlcnNpc3RlbmNlPzogYm9vbGVhblxyXG4gICAgKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzU3RyaW5nTnVsbChrZXkpKSByZXR1cm47XHJcbiAgICAgICAgY29uc3QgaGFuZGxlck1hcCA9IHRoaXMuX2hhbmRsZXJNYXA7XHJcbiAgICAgICAgaWYgKGhhbmRsZXJNYXAgJiYgaGFuZGxlck1hcFtrZXldKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYnJvYWRjYXN0KGtleSwgdmFsdWUsIGNhbGxiYWNrLCBwZXJzaXN0ZW5jZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbGV0IHN0aWNreU1hcCA9IHRoaXMuX3N0aWNrSGFuZGxlcnNNYXA7XHJcbiAgICAgICAgICAgIGlmICghc3RpY2t5TWFwKSB7XHJcbiAgICAgICAgICAgICAgICBzdGlja3lNYXAgPSB7fSBhcyBhbnk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGlja0hhbmRsZXJzTWFwID0gc3RpY2t5TWFwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IHN0aWNreUhhbmRsZXJzID0gc3RpY2t5TWFwW2tleV07XHJcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXI6IGJyb2FkY2FzdC5JU3RpY2t5SGFuZGxlciA9IHtcclxuICAgICAgICAgICAgICAgIGtleToga2V5IGFzIGFueSxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcclxuICAgICAgICAgICAgICAgIHBlcnNpc3RlbmNlOiBwZXJzaXN0ZW5jZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBpZiAoIXN0aWNreUhhbmRsZXJzKSB7XHJcbiAgICAgICAgICAgICAgICBzdGlja3lNYXBba2V5XSA9IFtoYW5kbGVyXVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3RpY2t5SGFuZGxlcnMucHVzaChoYW5kbGVyKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiDlrZfnrKbkuLLmmK/lkKbkuLrnqbogdW5kZWZpbmVkIG51bGwgXCJcIlxyXG4gICAgICogQHBhcmFtIHN0ciBcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9pc1N0cmluZ051bGwoc3RyOiBzdHJpbmcgfCBhbnkpIHtcclxuICAgICAgICByZXR1cm4gIXN0ciB8fCBzdHIudHJpbSgpID09PSBcIlwiO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiDmmK/lkKbmmK/mlbDnu4RcclxuICAgICAqIEBwYXJhbSB0YXJnZXQgXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfaXNBcnIodGFyZ2V0OiBhbnkpIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHRhcmdldCkgPT09IFwiW29iamVjdCBBcnJheV1cIjtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICog5bCG5bm/5pKt55qE5pWw5o2u5L2c5Li65Y+C5pWw77yM5omn6KGM5bm/5pKt55uR5ZCs5Zmo55qE6YC76L6RXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciDlub/mkq3nm5HlkKzlmahcclxuICAgICAqIEBwYXJhbSBkYXRhIOW5v+aSreeahOa2iOaBr+aVsOaNrlxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgc3RhdGljIF9ydW5IYW5kbGVyV2l0aERhdGEoaGFuZGxlcjogYnJvYWRjYXN0LklMaXN0ZW5lckhhbmRsZXIsIGRhdGE6IGFueSwgY2FsbGJhY2s6IGJyb2FkY2FzdC5MaXN0ZW5lcikge1xyXG4gICAgICAgIGlmIChoYW5kbGVyLmxpc3RlbmVyID09IG51bGwpIHJldHVybiBudWxsO1xyXG4gICAgICAgIGxldCByZXN1bHQ6IGFueTtcclxuICAgICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBoYW5kbGVyLmFyZ3MgPyBoYW5kbGVyLmFyZ3MudW5zaGlmdChjYWxsYmFjaykgOiBbY2FsbGJhY2tdO1xyXG4gICAgICAgICAgICByZXN1bHQgPSBoYW5kbGVyLmxpc3RlbmVyLmFwcGx5KGhhbmRsZXIuY29udGV4dCwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKCFoYW5kbGVyLmFyZ3MgJiYgIWRhdGEudW5zaGlmdCkgcmVzdWx0ID0gaGFuZGxlci5saXN0ZW5lci5hcHBseShoYW5kbGVyLmNvbnRleHQsIFtkYXRhLCBjYWxsYmFja10pO1xyXG4gICAgICAgIGVsc2UgaWYgKGhhbmRsZXIuYXJncykgcmVzdWx0ID0gaGFuZGxlci5saXN0ZW5lci5hcHBseShoYW5kbGVyLmNvbnRleHQsIFtkYXRhLCBjYWxsYmFja10uY29uY2F0KGhhbmRsZXIuYXJncykpO1xyXG4gICAgICAgIGVsc2UgcmVzdWx0ID0gaGFuZGxlci5saXN0ZW5lci5hcHBseShoYW5kbGVyLmNvbnRleHQsIFtkYXRhLCBjYWxsYmFja10pO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIOaJp+ihjOW5v+aSreebkeWQrOiAheeahOmAu+i+kVxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBzdGF0aWMgX3J1bkhhbmRsZXIoaGFuZGxlcjogYnJvYWRjYXN0LklMaXN0ZW5lckhhbmRsZXIsIGNhbGxiYWNrOiBicm9hZGNhc3QuTGlzdGVuZXIpIHtcclxuICAgICAgICBpZiAoaGFuZGxlci5saXN0ZW5lciA9PSBudWxsKSByZXR1cm4gbnVsbDtcclxuICAgICAgICBjb25zdCBhcmdzID0gaGFuZGxlci5hcmdzID8gaGFuZGxlci5hcmdzLnVuc2hpZnQoY2FsbGJhY2spIDogW2NhbGxiYWNrXTtcclxuICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGhhbmRsZXIubGlzdGVuZXIuYXBwbHkoaGFuZGxlci5jb250ZXh0LCBhcmdzKTtcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiDlm57mlLZoYW5kbGVyXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9yZWNvdmVySGFuZGxlcihoYW5kbGVyOiBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcikge1xyXG4gICAgICAgIGhhbmRsZXIuYXJncyA9IHVuZGVmaW5lZDtcclxuICAgICAgICBoYW5kbGVyLmNvbnRleHQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaGFuZGxlci5saXN0ZW5lciA9IHVuZGVmaW5lZDtcclxuICAgICAgICBoYW5kbGVyLmtleSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLl91bnVzZUhhbmRsZXJzLnB1c2goaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPlmhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBrZXkgXHJcbiAgICAgKiBAcGFyYW0gbGlzdGVuZXIgXHJcbiAgICAgKiBAcGFyYW0gY29udGV4dCBcclxuICAgICAqIEBwYXJhbSBvbmNlIFxyXG4gICAgICogQHBhcmFtIGFyZ3MgXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfZ2V0SGFuZGxlcihrZXk6IHN0cmluZywgbGlzdGVuZXI6IGFueSwgY29udGV4dDogYW55LCBvbmNlOiBib29sZWFuLCBhcmdzOiBhbnlbXSkge1xyXG4gICAgICAgIGNvbnN0IHVudXNlSGFuZGxlcnMgPSB0aGlzLl91bnVzZUhhbmRsZXJzO1xyXG4gICAgICAgIGxldCBoYW5kbGVyOiBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcjtcclxuICAgICAgICBpZiAodW51c2VIYW5kbGVycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaGFuZGxlciA9IHVudXNlSGFuZGxlcnMucG9wKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaGFuZGxlciA9IHt9IGFzIGFueTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFuZGxlci5rZXkgPSBrZXk7XHJcbiAgICAgICAgaGFuZGxlci5saXN0ZW5lciA9IGxpc3RlbmVyO1xyXG4gICAgICAgIGhhbmRsZXIuY29udGV4dCA9IGNvbnRleHQ7XHJcbiAgICAgICAgaGFuZGxlci5vbmNlID0gb25jZTtcclxuICAgICAgICBoYW5kbGVyLmFyZ3MgPSBhcmdzO1xyXG4gICAgICAgIHJldHVybiBoYW5kbGVyO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiDmt7vliqDlub/mkq3nm5HlkKxcclxuICAgICAqIOWmguaenOaYr+ebkeWQrDHmrKHvvIzliJnkvJrnp7vpmaTkuIrkuIDmrKHnm7jlkIznmoTnm5HlkKxcclxuICAgICAqIOS8muWIpOaWreaYr+WQpuacieeymOaAp+W5v+aSre+8jOWmguaenOacieWwseS8muinpuWPkeW5v+aSrVxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfYWRkSGFuZGxlcihoYW5kbGVyOiBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcikge1xyXG4gICAgICAgIGxldCBoYW5kbGVyTWFwID0gdGhpcy5faGFuZGxlck1hcDtcclxuICAgICAgICBpZiAoaGFuZGxlci5vbmNlKSB7XHJcbiAgICAgICAgICAgIHRoaXMub2ZmKGhhbmRsZXIua2V5LCBoYW5kbGVyLmxpc3RlbmVyLCBoYW5kbGVyLmNvbnRleHQsIGhhbmRsZXIub25jZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghaGFuZGxlck1hcCkge1xyXG4gICAgICAgICAgICBoYW5kbGVyTWFwID0ge30gYXMgYW55O1xyXG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVyTWFwID0gaGFuZGxlck1hcDtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgZXZlbnRzID0gaGFuZGxlck1hcFtoYW5kbGVyLmtleV07XHJcbiAgICAgICAgaWYgKGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNBcnIoZXZlbnRzKSkge1xyXG4gICAgICAgICAgICAgICAgKGV2ZW50cyBhcyBicm9hZGNhc3QuSUxpc3RlbmVySGFuZGxlcltdKS5wdXNoKGhhbmRsZXIpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlck1hcFtoYW5kbGVyLmtleV0gPSBbZXZlbnRzIGFzIGFueSwgaGFuZGxlcl07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBoYW5kbGVyTWFwW2hhbmRsZXIua2V5XSA9IGhhbmRsZXI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHN0aWNreU1hcCA9IHRoaXMuX3N0aWNrSGFuZGxlcnNNYXA7XHJcbiAgICAgICAgaWYgKHN0aWNreU1hcCkge1xyXG4gICAgICAgICAgICBjb25zdCBzdGlja3lIYW5kbGVycyA9IHN0aWNreU1hcFtoYW5kbGVyLmtleV07XHJcbiAgICAgICAgICAgIGlmIChzdGlja3lIYW5kbGVycykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGhhbmRsZXI6IGJyb2FkY2FzdC5JU3RpY2t5SGFuZGxlcjtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RpY2t5SGFuZGxlcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyID0gc3RpY2t5SGFuZGxlcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5icm9hZGNhc3QoaGFuZGxlci5rZXkgYXMgYW55LCBoYW5kbGVyLnZhbHVlLCBoYW5kbGVyLmNhbGxiYWNrLCBoYW5kbGVyLnBlcnNpc3RlbmNlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHN0aWNreU1hcFtoYW5kbGVyLmtleV0gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGhhbmRsZXIua2V5ICE9PSB0aGlzLmtleXMub25MaXN0ZW5lck9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYnJvYWRjYXN0KHRoaXMua2V5cy5vbkxpc3RlbmVyT24sIGhhbmRsZXIua2V5KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiDlj5blgLxcclxuICAgICAqIEBwYXJhbSBrZXkgXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyB2YWx1ZTxrZXlUeXBlIGV4dGVuZHMga2V5b2YgTXNnS2V5VHlwZSA9IGFueT4oa2V5OiBrZXlUeXBlKTogVmFsdWVUeXBlW2Jyb2FkY2FzdC5Ub0FueUluZGV4S2V5PGtleVR5cGUsIFZhbHVlVHlwZT5dIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWVNYXAgJiYgdGhpcy5fdmFsdWVNYXBba2V5XTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICog6ZSA5q+B5bm/5pKt57O757ufXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkaXNwb3NlKCkge1xyXG4gICAgICAgIHRoaXMuX2hhbmRsZXJNYXAgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgdGhpcy5fc3RpY2tIYW5kbGVyc01hcCA9IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLl92YWx1ZU1hcCA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbn0iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0E7Ozs7SUFXSTtRQUNJLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBUyxFQUFFO1lBQzdCLEdBQUcsRUFBRSxVQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNYLE9BQU8sQ0FBQyxDQUFDO2FBQ1o7U0FDSixDQUFDLENBQUE7UUFDRixJQUFJLENBQUMsU0FBUyxHQUFHLEVBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztLQUM1Qjs7Ozs7Ozs7Ozs7SUFXTSxzQkFBRSxHQUFULFVBQ0ksT0FBNEksRUFDNUksUUFBK0ksRUFDL0ksT0FBYSxFQUNiLElBQWMsRUFDZCxJQUFZO1FBRVosSUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLEVBQUU7WUFDN0IsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTztZQUN0QixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDOUU7YUFBTTtZQUNILElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDdEIsSUFBTSxRQUFRLEdBQWlDLE9BQWMsQ0FBQztnQkFDOUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQ3RDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ2pD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
