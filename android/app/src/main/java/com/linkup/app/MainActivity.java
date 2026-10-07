package com.linkup.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LinkUpSettingsPlugin.class);
        registerPlugin(LinkUpAuthVaultPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
