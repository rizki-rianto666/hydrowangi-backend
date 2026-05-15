#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

String currentSSID = "ZTE_2.4G_SANTUY";
String currentPassword = "UR5EPYXt";

String serverName = "https://hydrowangi-backend.vercel.app/api/";
String secret_key = "hydrowangi_iot_Hy283JSi";

#define pH_PIN 34
#define TDS_PIN 35
#define ONE_WIRE_BUS 32

#define Offset 0.00
#define samplingInterval 20
#define printInterval 2000
#define ArrayLenth 40

#define NUTRISI_PIN_1 5
#define NUTRISI_PIN_2 18

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

int pHArray[ArrayLenth];
int pHArrayIndex = 0;

float pHVoltage, pHValue;
float suhuC = 0.0;
float tdsValue = 0.0;
float tdsVoltage = 0.0;

void setup() {

  Serial.begin(115200);

  sensors.begin();

  pinMode(NUTRISI_PIN_1, OUTPUT);
  pinMode(NUTRISI_PIN_2, OUTPUT);

  digitalWrite(NUTRISI_PIN_1, LOW);
  digitalWrite(NUTRISI_PIN_2, LOW);

  Serial.println("Connecting WiFi...");

  WiFi.begin(
    currentSSID.c_str(),
    currentPassword.c_str()
  );

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi Connected!");
  Serial.println(WiFi.localIP());
}

void loop() {

  static unsigned long wifiCheckTime = millis();
  static unsigned long samplingTime = millis();
  static unsigned long printTime = millis();
  static unsigned long pumpCheckTime = millis();

  // cek update wifi tiap 10 detik
  if (millis() - wifiCheckTime > 10000) {
    checkWifiUpdate();
    wifiCheckTime = millis();
  }

  // sampling pH
  if (millis() - samplingTime > samplingInterval) {

    pHArray[pHArrayIndex++] = analogRead(pH_PIN);

    if (pHArrayIndex == ArrayLenth) {
      pHArrayIndex = 0;
    }

    samplingTime = millis();
  }

  // update sensor
  if (millis() - printTime > printInterval) {
    updateSensorData();
    printTime = millis();
  }

  // check pump
  if (millis() - pumpCheckTime > 1000) {
    checkPump();
    pumpCheckTime = millis();
  }
}

void updateSensorData() {

  sensors.requestTemperatures();

  suhuC = sensors.getTempCByIndex(0);

  float avgValue = averageArray(pHArray, ArrayLenth);

  pHVoltage = avgValue * (3.3 / 4095.0);

  pHValue = 7 + ((2.5 - pHVoltage) / 0.18) + Offset;

  int tdsADC = analogRead(TDS_PIN);

  tdsVoltage = tdsADC * (3.3 / 4095.0);

  float compensationCoefficient =
    1.0 + 0.02 * (suhuC - 25.0);

  float compensatedVoltage =
    tdsVoltage / compensationCoefficient;

  tdsValue =
    (
      133.42 * pow(compensatedVoltage, 3)
      - 255.86 * pow(compensatedVoltage, 2)
      + 857.39 * compensatedVoltage
    ) * 0.5;
}

void checkPump() {

  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;

    http.begin(serverName + "nutrition-pump");

    http.addHeader(
      "x-secret-key",
      secret_key
    );

    http.setTimeout(3000);

    int httpResponseCode = http.GET();

    if (httpResponseCode == 200) {

      String response = http.getString();

      StaticJsonDocument<200> doc;

      DeserializationError error =
        deserializeJson(doc, response);

      if (!error) {

        bool on = doc["nutritionOn"];

        if (on) {

          digitalWrite(NUTRISI_PIN_1, HIGH);
          digitalWrite(NUTRISI_PIN_2, HIGH);

        } else {

          digitalWrite(NUTRISI_PIN_1, LOW);
          digitalWrite(NUTRISI_PIN_2, LOW);
        }
      }
    }

    http.end();
  }
}

void checkWifiUpdate() {

  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;

    http.begin(serverName + "wifi");

    http.addHeader(
      "x-secret-key",
      secret_key
    );

    int httpResponseCode = http.GET();

    if (httpResponseCode == 200) {

      String response = http.getString();

      StaticJsonDocument<200> doc;

      deserializeJson(doc, response);

      String newSSID =
        doc["wifi_username"];

      String newPassword =
        doc["wifi_password"];

      Serial.println("Checking WiFi update...");
      Serial.println(newSSID);

      // cek apakah ada perubahan
      if (
        newSSID != currentSSID ||
        newPassword != currentPassword
      ) {

        Serial.println("WiFi changed!");

        // simpan wifi lama
        String oldSSID = currentSSID;
        String oldPassword = currentPassword;

        // disconnect wifi lama
        WiFi.disconnect();

        delay(1000);

        // connect wifi baru
        WiFi.begin(
          newSSID.c_str(),
          newPassword.c_str()
        );

        int retry = 0;

        while (
          WiFi.status() != WL_CONNECTED &&
          retry < 20
        ) {

          delay(500);

          Serial.print(".");

          retry++;
        }

        // kalau sukses
        if (WiFi.status() == WL_CONNECTED) {

          currentSSID = newSSID;
          currentPassword = newPassword;

          Serial.println("");
          Serial.println("Connected to new WiFi!");

        } else {

          Serial.println("");
          Serial.println("Failed connect!");

          // balik ke wifi lama
          WiFi.begin(
            oldSSID.c_str(),
            oldPassword.c_str()
          );

          while (WiFi.status() != WL_CONNECTED) {

            delay(500);

            Serial.print("*");
          }

          Serial.println("");
          Serial.println("Reconnected old WiFi!");
        }
      }
    }

    http.end();
  }
}

double averageArray(int *arr, int number) {

  int i, max, min;

  double avg;

  long amount = 0;

  if (number <= 0) {
    return 0;
  }

  if (number < 5) {

    for (i = 0; i < number; i++) {
      amount += arr[i];
    }

    avg = amount / number;

    return avg;

  } else {

    if (arr[0] > arr[1]) {

      max = arr[0];
      min = arr[1];

    } else {

      max = arr[1];
      min = arr[0];
    }

    for (i = 2; i < number; i++) {

      if (arr[i] > max) {
        max = arr[i];
      }

      if (arr[i] < min) {
        min = arr[i];
      }

      amount += arr[i];
    }

    amount = amount - max - min;

    avg = amount / (number - 2);
  }

  return avg;
}