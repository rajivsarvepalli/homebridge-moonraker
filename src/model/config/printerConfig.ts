export interface PrinterConfig {
    moonrakerUrl: string;
    name: string;
    cameraUrls: string[];
    temperatureSensors: TemperatureSensor[];
    manufacturer: string;
    model: string;
    serialNumber: string;
    maxBedHeaterTemp: number;
    maxExtruderHeaterTemp: number;
}

export interface TemperatureSensor {
    name: string;
    moonrakerName: string;
    minTemp: number;
    maxTemp: number;
}