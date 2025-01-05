import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Button,
  Vibration,
  Alert,
} from "react-native";
import { Accelerometer } from "expo-sensors";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import * as Notifications from "expo-notifications";
import axios from "axios";
import { Buffer } from "buffer";
import Slider from '@react-native-community/slider';

export default function App() {
  const [isShakeTracking, setIsShakeTracking] = useState(false);
  const [shakeDetected, setShakeDetected] = useState(false);
  const [shakeData, setShakeData] = useState({ x: 0, y: 0, z: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<string[]>([]);
  const [newContact, setNewContact] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCancelClicked, setIsCancelClicked] = useState(false);
  const [lastShake, setLastShake] = useState({ x: 0, y: 0, z: 0 });
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [shakeThreshold, setShakeThreshold] = useState(6);

  const intervalId = useRef<NodeJS.Timeout | null>(null);
  //triggerEmergencyActions
  const [emailSent, setEmailSent] = useState(false);


  /////////////////////////////////////////////////////////////////////////


  useEffect(() => {
    if (isCancelClicked && intervalId.current) {
      clearInterval(intervalId.current);
    }
  }, [isCancelClicked]);
  //getCurrentLocation
  const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location access is required for emergency alerts.");
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error("Location Error:", error);
      Alert.alert("Error", "Failed to get current location.");
      return null;
    }
  };
  //handleShakeDetection
  const handleShakeDetection = (acceleration: { x: number; y: number; z: number }) => {
    try {
      const { x, y, z } = acceleration;
      setShakeData({ x, y, z });

      const diffX = Math.abs(x - lastShake.x);
      const diffY = Math.abs(y - lastShake.y);
      const diffZ = Math.abs(z - lastShake.z);

      if (diffX + diffY + diffZ > shakeThreshold && countdown === null) {
        setShakeDetected(true);
        setLastShake({ x, y, z });
        triggerEmergencyCountdown();
      }
    } catch (error) {
      console.error("Shake Detection Error:", error);
      Alert.alert("Error", "An error occurred during shake detection.");
    }
  };
  //toggleShakeDetection
  const toggleShakeDetection = () => {
    try {
      if (isShakeTracking) {
        Accelerometer.removeAllListeners();
        setShakeDetected(false);
        setCountdown(null);
        setIsCancelClicked(false);
      } else {
        Accelerometer.addListener(handleShakeDetection);
      }
      setIsShakeTracking(!isShakeTracking);
    } catch (error) {
      console.error("Shake Toggle Error:", error);
      Alert.alert("Error", "An error occurred while toggling shake detection.");
    }
  };
  //triggerEmergencyCountdown
  const triggerEmergencyCountdown = () => {
    try {
      Vibration.vibrate([500, 500, 500]);
      let timer = 10;
      setCountdown(timer);
      setIsCancelClicked(false);
      intervalId.current = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown !== null && prevCountdown > 0 && !isCancelClicked) {
            return prevCountdown - 1;
          } else {
            clearInterval(intervalId.current!);
            if (!isCancelClicked) {
              triggerEmergencyActions();
            }
            return 0;
          }
        });
      }, 1000);
    } catch (error) {
      console.error("Countdown Error:", error);
      Alert.alert("Error", "An error occurred during the emergency countdown.");
    }
  };


  //triggerEmergencyActions
  const triggerEmergencyActions = async () => {
    try {
      // Check if the email has already been sent
      if (emailSent) {
        return; // Do nothing if the email has already been sent
      }

      // Check if emergencyContacts list is empty
      if (!emergencyContacts || emergencyContacts.length === 0) {
        Alert.alert(
          "Missing Contact",
          "No email address provided. Please add at least one emergency contact."
        );
        return; // Stop execution if no emails are provided
      }

      // Schedule notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Emergency Alert",
          body: "Sending emergency notifications!",
        },
        trigger: null,
      });

      try {
        Speech.speak("Emergency detected. Sending help messages.");
      } catch (speechError) {
        console.error("Speech Error:", speechError);
      }

      // Get location
      const location = await getCurrentLocation();
      if (!location) return;

      // Loop through emergencyContacts and send emails
      for (const contact of emergencyContacts) {
        if (contact.includes("@")) {
          const API_KEY = "05c28ddb082e6c0ce43762d20130a757-f55d7446-ea4c9fe9";
          const DOMAIN = "sandboxcb777769a3a24d2dbb13cecdbac3211d.mailgun.org";
          const BASE_URL = `https://api.mailgun.net/v3/${DOMAIN}/messages`;

          const formData = new FormData();
          formData.append("from", `Emergency Alert <mailgun@${DOMAIN}>`);
          formData.append("to", contact);
          formData.append(
            "text",
            `Help! My current location is: Latitude ${location.latitude}, Longitude ${location.longitude}\n\nView on Google Maps: https://www.google.com/maps?q=${location.latitude},${location.longitude}`
          );

          try {
            await axios.post(BASE_URL, formData, {
              headers: {
                Authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString("base64")}`,
                "Content-Type": "multipart/form-data",
              },
            });
            Alert.alert("Success", `Email sent successfully to ${contact}`);
          } catch (emailError) {
            console.error("Email Error:", emailError);
            Alert.alert("Error", `Failed to send email to ${contact}`);
          }
        }
      }

      // Set emailSent to true after the emails are sent
      setEmailSent(true);
    } catch (error) {
      console.error("Emergency Actions Error:", error);
      Alert.alert("Error", "An error occurred during emergency actions.");
    }
  };

  //cancelEmergency

  const cancelEmergency = () => {
    try {
      setCountdown(null);
      setIsCancelClicked(true);
      Vibration.cancel();
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Emergency Canceled",
          body: "The emergency alert has been canceled.",
        },
        trigger: null,
      });
    } catch (error) {
      console.error("Cancel Error:", error);
      Alert.alert("Error", "An error occurred while canceling the emergency.");
    }
  };

  const addContact = () => {
    try {
      if (newContact.trim() && /\S+@\S+\.\S+/.test(newContact)) {
        setEmergencyContacts([...emergencyContacts, newContact]);
        setNewContact("");
      } else {
        Alert.alert("Invalid Email", "Please enter a valid email address.");
      }
    } catch (error) {
      console.error("Add Contact Error:", error);
      Alert.alert("Error", "An error occurred while adding a contact.");
    }
  };

  const removeContact = (index: number) => {
    try {
      const updatedContacts = [...emergencyContacts];
      updatedContacts.splice(index, 1);
      setEmergencyContacts(updatedContacts);
    } catch (error) {
      console.error("Remove Contact Error:", error);
      Alert.alert("Error", "An error occurred while removing a contact.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal animationType="slide" transparent={false} visible={modalVisible}>
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalHeader}>Manage Emergency Contacts</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter email"
            value={newContact}
            onChangeText={(text) => setNewContact(text)}
          />
          <Button title="Add Contact" onPress={addContact} color="#32a852"
          />
          <Text style={styles.status}>Current Emergency Contacts:</Text>

          <FlatList
            data={emergencyContacts}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.contactItem}>
                <Text style={styles.contactText}>{item}</Text>
                <Button
                  title="Remove"
                  onPress={() => removeContact(index)}
                  color="orange"
                />
              </View>
            )}
          />
          {/* shake  */}
          {/* Shake Threshold Slider */}
          <View style={styles.Slidercontainer}>
            <Text style={styles.Sliderstatus}>Shake Threshold: {shakeThreshold.toFixed(1)}</Text>
            <Slider
              style={styles.slider} // Use slider-specific styles
              minimumValue={2}
              maximumValue={10}
              step={0.1} // Adjust sensitivity in increments of 0.1
              value={shakeThreshold}
              onValueChange={(value) => setShakeThreshold(value)}
              minimumTrackTintColor="#1EB1FC"
              maximumTrackTintColor="#ccc"
              thumbTintColor="#1EB1FC"
            />
            <Text style={styles.info}>
              Adjust the shake sensitivity. Lower values make it more sensitive.
            </Text>
          </View>

          {/* shake  */}
          <Button title="Close" onPress={() => setModalVisible(false)} />
        </SafeAreaView>
      </Modal>
      <View style={styles.mainContainer}>
        <Text style={styles.header}>
          DriveSafe: <Text style={styles.subHeader}>Your Personal Safety Companion</Text>
        </Text>
        <Text style={styles.status}>Are you in a vehicle?</Text>
        <View style={styles.activateBtnContainer}>
          <Button
            title={
              isShakeTracking
                ? "Deactivate Shake Detection"
                : "Activate Shake Detection"
            }
            onPress={toggleShakeDetection}
            color="#3ead88"
          />
        </View>
        <Text style={styles.status}>
          Shake Detected: {shakeDetected ? "Yes" : "No"}
        </Text>
        <Button
          title="Send SOS Email"
          onPress={triggerEmergencyActions}
          color="#ff1414"
        />
        <Text>
          Shake Data: x: {shakeData.x.toFixed(2)}, y: {shakeData.y.toFixed(2)},
          z: {shakeData.z.toFixed(2)}
        </Text>
        {shakeDetected && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>Emergency in: {countdown}s</Text>
            <Button title="Cancel" onPress={cancelEmergency} color="orange" />
          </View>
        )}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.settingsText}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  modalContainer: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#5eb3bd",
    margin: 5,



  },
  modalHeader: {
    fontSize: 23,
    fontWeight: "bold",
    marginBottom: 20,

  },
  input: {
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  input2: {
    borderWidth: 3,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    marginBottom: 25,
    alignItems: "center",
    width: "30%",
    marginLeft: "35%",
    textAlign: "center",
    backgroundColor: "#fff",


  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  contactText: {
    fontSize: 16,
  },
  mainContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#5eb3bd",
    margin: 5,
  },
  header: {
    fontSize: 25,
    fontWeight: "bold",
    marginBottom: 20,
  },
  subHeader: {
    fontWeight: 300,
    fontStyle: "italic",

  },
  status: {
    fontSize: 17,

    marginBottom: 10,
    textAlign: "center",
    fontWeight: 300,
    marginTop: 20,
  },
  activateBtnContainer: {
    marginBottom: 20,
  },
  countdownContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  countdownText: {
    fontSize: 18,
    color: "red",
    marginBottom: 10,
  },
  settingsButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#ccc",
    borderRadius: 20,
    padding: 5,
    borderWidth: 2,
    borderColor: "#e3dede",
  },
  settingsText: {
    fontSize: 25,
    padding: 2,

  },





  Slidercontainer: {
    justifyContent: "center",
    alignItems: "center", // Center-align the slider
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 10,
    marginLeft: 10,
    marginBottom: 10,
    width: "90%",
  },

  Sliderstatus: {
    fontSize: 16,
    marginBottom: 5,
    textAlign: "center",
    fontWeight: "500", // Adjust for better readability
  },

  slider: {
    width: "100%", // Use full width within the container
    height: 40,
  },

  info: {
    fontSize: 14,
    color: "gray",
    marginTop: 5,
    textAlign: "center", // Align the info text
  },
})  