package com.ridesharing.app.utils

import android.util.Log
import com.ridesharing.app.BuildConfig

/**
 * Global logger that only prints in DEBUG builds to save CPU and battery.
 */
object AppLogger {
    fun d(tag: String, msg: String) {
        if (BuildConfig.DEBUG) Log.d(tag, msg)
    }

    fun e(tag: String, msg: String, throwable: Throwable? = null) {
        if (BuildConfig.DEBUG) Log.e(tag, msg, throwable)
    }

    fun i(tag: String, msg: String) {
        if (BuildConfig.DEBUG) Log.i(tag, msg)
    }

    fun w(tag: String, msg: String) {
        if (BuildConfig.DEBUG) Log.w(tag, msg)
    }
}
