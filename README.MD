<p align="center">
   <a href="https://homebridge.io/"><img src="https://raw.githubusercontent.com/homebridge/branding/latest/logos/homebridge-wordmark-logo-vertical.png" height="150"></a>
</p>
<span align="center">

# homebridge-moonraker
Homebridge plugin to control [Moonraker](https://moonraker.readthedocs.io/) enabled 3D printers

</span>

### :house: Homebridge Moonraker

Homebridge Moonraker is a Homebridge plugin designed to enable HomeKit integrations (Apple Home)
with Moonraker-enabled 3D printers. [Moonraker](https://moonraker.readthedocs.io/) is a web server developed for the
[Klipper](https://www.klipper3d.org/) 3D printing firmware.

Below is a summary of the accessories/features that homebridge-moonraker provides:

* A thermostat for the bed heater.
* A thermostat for the extruder heater.
* A humidity sensor representing print progress.
* A light for print controls.

Multiple printers for a single plugin instance are supported.

I would recommend running [homebridge-camera-ui](https://github.com/seydx/homebridge-camera-ui/tree/master) to have your printer camera
available on Homebridge and Apple Home. You can supply a URL inside the config of this plugin
to notify Camera.UI to trigger recordings for printer failures.

### :books: Documentation

Refer to the [:package: Installing](#package-installing) section to understand how to install and configure this library.

The following features are available via accessories (each one is opted into via the plugin configuration):

* A thermostat for the bed heater - which can control your bed heater
* A thermostat for the extruder heater - which can control your extruder heater.
* A humidity sensor representing progress.
* A temperature sensor for the chamber.
* 2 contact sensors for print canceled or print error occurrences. These sensors can be enabled for notifications inside Apple Home to provide printer errors or cancellations directly to your phone.
* A light for print controls where the following is true:
  * Light brightness represents print progress.
  * Turning the light off pauses the print.
  * Setting the light brightness cancels the print (analogous to forcing completion of a print since brightness represents print progress).


### :package: Installing
If you are new to Homebridge, please first read the [Homebridge](https://homebridge.io/) [documentation](https://github.com/homebridge/homebridge/wiki) and installation instructions before proceeding.

If you have installed the [Homebridge Config UI](https://github.com/homebridge/homebridge-config-ui-x), you can install this plugin by going to the `Plugins` tab and searching for `homebridge-moonraker` and installing it. Configuration is available via that same UI post-installation.

### :construction_worker: Contributing

Contributions are welcome.
To learn more, see the [Contributor Guide]().


### :closed_book: License

Distributed under the terms of the [APACHE](https://www.apache.org/licenses/LICENSE-2.0) license.


### :boom: Issues

If you encounter any issues or problems,
please [file an issue](https://github.com/rajivsarvepalli/homebridge-moonraker/issues) along with a detailed description.