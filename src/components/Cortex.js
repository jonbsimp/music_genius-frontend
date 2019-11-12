import React from "react";
import Websocket from "react-websocket";
import { Button } from "reactstrap"


export default class Cortex extends React.Component{
  constructor(props) {
    super(props);
      this.state = {
        token: "", //storing cortext token for authentication
        method: "", //storing the last request method so we know how to handle the response
        headset: "", //storing the headset id
        connected: false,
        id_sequence: 1,  // sequence for websocket calls
        callbacks: {},  // keys are id_sequence, values are callbacks
        session_id: "",
        session_connected: false,
        all_streams: [ "met", "fac"],
        eng: 0,
        exc: 0,
        str: 0,
        rel: 0,
        int: 0,
        foc: 0,
        numSamples: 0,
        prevEyeAction: "neutral",
        prev2EyeAction: "neutral"
      };
    
    this.callbacks = {};  // keys are id_sequence, values are callbacks
    this.id_sequence = 1;  // sequence for websocket calls
    this.handleData = this.handleData.bind(this);
  }

  handleOpen() {
    console.log("[DEBUG] connected");
  }
  
  handleSpotifyCommand(command){
    console.log("[Cortex] received message: " + command)

    if (command === "reset"){
      console.log("resetting average");
      this.resetAvg();
    } 
  }

  sendMessage(msg, callback){
      let id = this.id_sequence
      this.id_sequence += 1;
      this.callbacks[id] = callback;
      //console.log(msg);
      this.refWebSocket.sendMessage(JSON.stringify(msg));
  }
    
  sendHello(){
    // Grab the current id_sequence and increment
    // let id = this.id_sequence;
    // this.id_sequence += 1;
    // this.callbacks[id] = this.hello_callback;set up our callback
    let msg = {
      "jsonrpc": "2.0",
      "method": "getCortexInfo",
      "id":this.id_sequence
    }
    this.sendMessage(msg, this.hello_callback);
  }

  hello_callback = (data) => {
    console.log("Running callback for sendHello()");
    console.log(data);
    // remove callback from callbacks object
    delete this.callbacks[data.id];
  }

  getUserLogin(){
    let msg = {
      "jsonrpc": "2.0",
      "method": "getUserLogin",
      "id":this.id_sequence
    }
    this.sendMessage(msg, this.userLogin_callback);
  }

  userLogin_callback = (data) => {
    console.log("Running callback for userLogin()");
    console.log(data);
    // remove callback from callbacks object
    delete this.callbacks[data.id];
    this.getRequestAccess();
  }

  getRequestAccess(){
    let msg = {
      "id":this.id_sequence,
      "jsonrpc": "2.0",
      "method": "requestAccess",
      "params": {
        "clientId": "zrTtgE4m4XN2z74UC5wRXOMEfqqtT20glr0rJf08",
        "clientSecret": "UyNffuiGrWOIUJfrUrqJeiAbVAsgNm7Tyw58AVbYkKEGI4l5MPzKo56K0vvuoWOjgujx5YNoc6CcJvZxOxgICsAjwsy63AF4gfvq9a68fdvY4YgOzafRXeqjWwAbYymK"
      }
    }
    this.sendMessage(msg, this.requestAccess_callback);
  }

  requestAccess_callback = (data) => {
    console.log("[DEBUG] Requesting access... please check your cortext app!");
    console.log(data);
    // remove callback from callbacks object
    delete this.callbacks[data.id];
    this.getAuthentication();
  }

  getAuthentication(){
    let msg = {
      "id": this.id_sequence,
      "jsonrpc": "2.0",
      "method": "authorize",
      "params": {
        "clientId": "zrTtgE4m4XN2z74UC5wRXOMEfqqtT20glr0rJf08",
        "clientSecret": "UyNffuiGrWOIUJfrUrqJeiAbVAsgNm7Tyw58AVbYkKEGI4l5MPzKo56K0vvuoWOjgujx5YNoc6CcJvZxOxgICsAjwsy63AF4gfvq9a68fdvY4YgOzafRXeqjWwAbYymK"
      }
    }
    this.sendMessage(msg, this.authentication_callback);
  }

  authentication_callback = (data) => {
    console.log("Running callback for authentication()");
    console.log(data);
      this.setState({
        token: data.result.cortexToken
    })
      
    console.log("[DEBUG] received token = " + this.state.token)
    // remove callback from callbacks object
    delete this.callbacks[data.id];
    this.queryHeadsets();
  }

  queryHeadsets(){
    let msg = {
      "id":this.id_sequence,
      "jsonrpc": "2.0",
      "method": "queryHeadsets",
      "params": {
        "id": "EPOC-*"
      }
    };
    this.sendMessage(msg, this.queryHeadsets_callback);
  }

  queryHeadsets_callback = (data) => {
    console.log("Running callback for queryHeadset()");
    console.log(data);
    if (data.result.length > 0){
      this.setState({
          headset: data.result[0].id
    })
        
      console.log("[DEBUG] headset id is: " + this.state.headset);
    }else{
      this.setState({
           headset: ""
      })
      console.log("[DEBUG] no headsets found");
    }
    // remove callback from callbacks object
    delete this.callbacks[data.id];
    this.connectHeadset();
  }

  connectHeadset(){
    if (this.state.headset !== ""){
      let msg = {
        "id":this.id_sequence,
        "jsonrpc": "2.0",
        "method": "controlDevice",
        "params": {
          "command": "connect",
          "headset": this.state.headset
        }
      };
      console.log(msg);
      this.sendMessage(msg, this.controlDevice_callback);
    }
  }

  disconnectHeadset(){
    if (this.state.connected === true){ //check if app is actually connected
      if (this.state.headset !== ""){
        let msg = {
          "id": this.id_sequence,
          "jsonrpc": "2.0",
          "method": "controlDevice",
          "params": {
            "command": "disconnect",
            "headset": this.state.headset            }
          };
        this.sendMessage(msg, this.controlDevice_callback);
      }
    }else{
      console.log("Already disconnected, please connect first!")
    }
  }

  controlDevice_callback = (data) => {
    console.log("Running callback for connect and disconnect()");
    console.log(data);
    if (data.error) {
      console.log("error connecting/disconnecting: " + data.error.message);
    } else {
      if (data.result.command === "connect"){
        console.log("connected!!!");
         this.setState({
              connected: true
        });
      }else if (data.result.command === "disconnect"){
        console.log("disconnected. :(");
         this.setState({
             connected: false
        });
      }else { //refresh
        console.log("refresh request was called, not sure what we do with that.")
      }
  }
    // remove callback from callbacks object
    delete this.callbacks[data.id];
  }


  startSession(){
    let msg = {
      "id": this.id_sequence,
      "jsonrpc": "2.0",
      "method": "createSession",
      "params": {
        "cortexToken": this.state.token,
        "headset": this.state.headset,
        "status": "active"
      }
    };
    this.sendMessage(msg, this.startSession_callback); 
  }

  startSession_callback = (data) => {
    console.log("Running callback for startSession()");
    console.log(data);
    if (data.error){
      console.log("error starting session: " + data.error.message);
    }else {
       this.setState({
            session_id: data.result.id,
            session_connected: true
      })
      console.log(`Session id is ${this.state.session_id}`);
      this.subscribe();
    }
    delete this.callbacks[data.id];
  }

    // querySession(){
    //     let id = this.id_sequence;
    //         this.id_sequence += 1;
    //         this.callbacks[id] = this.querySession_callback;
    //     let msg = {
    //         "id":this.id_sequence,
    //         "jsonrpc": "2.0",
    //         "method": "querySessions",
    //         "params": {
    //             "cortexToken": this.state.token
    //         }
    //     };
    //     this.refWebSocket.sendMessage(JSON.stringify(msg));
    // }

    // querySession_callback = (data) => {

    //     console.log("Running callback for querySession()");
    //     console.log(data);
    // delete this.callbacks[data.id];
    // }


  closeSession(){
    if (this.state.session_connected === true){
          let msg = {
                      "id":this.id_sequence,
                      "jsonrpc": "2.0",
                      "method": "updateSession",
                      "params": {
                          "cortexToken": this.state.token,
                          "session": this.state.session_id,
                          "status": "close"
              }
          
                   };
                  this.sendMessage(msg, this.closeSession_callback);
    }else{
      console.log("There is currently no active session");
    }
  }

  closeSession_callback = (data) => {
    console.log("Running callback for closeSession()");
    console.log(data);
    this.setState({
         session_connected: false
    });
    delete this.callbacks[data.id];
    this.unsubscribe();
  }

  // streams has default value of all streams; if user does not specify streams, all_streams will be subscribed
  subscribe(streams = this.state.all_streams){
    if (this.state.connected === true && this.state.session_connected === true){
      let msg = {
        "id": this.id_sequence,
        "jsonrpc": "2.0",
        "method": "subscribe",
        "params": {
          "cortexToken": this.state.token,
          "session": this.state.session_id,
          "streams": streams
        }
      };
      this.sendMessage(msg, this.subscribe_callback);
    }
  }

  subscribe_callback = (data) => {
    console.log("Running callback for subscribe()");
    console.log(data);
    delete this.callbacks[data.id];
  }

  unsubscribe(){
    if (this.state.connected === true && this.state.session_connected === true){
      let msg = {
        "id": this.id_sequence,
        "jsonrpc": "2.0",
        "method": "unsubscribe",
        "params": {
          "cortexToken": this.state.token,
          "session": this.state.session_id,
          "streams": this.state.all_streams

        }
      };
      this.sendMessage(msg, this.unsubscribe_callback);
    }
  }

  unsubscribe_callback = (data) => {
    console.log("Running callback for unsubscribe()");
    console.log(data);
    delete this.callbacks[data.id];
  }

  getDetectionInfo(){
    //request for facial detection info
    let msg = {
      "id": this.id_sequence,
      "jsonrpc": "2.0",
      "method": "getDetectionInfo",
      "params": {
          "detection": "facialExpression"
      }
    };
    this.sendMessage(msg, this.startSession_callback); 
  }

  getDetectionInfo_callback = (data) => {
    console.log("Running callback for getDetectionInfo()");
    console.log(data);
  }

  handleData(data) {
    let result = JSON.parse(data);
    // let engArray = [];
    // let excArray = [];
    // let strArray = [];
    // let relArray = [];
    // let intArray = [];
    // let focArray = [];
    console.log(result);
    if (result.id){
      // call the registered callback
      console.log("executing callback for id = " + result.id);
      this.callbacks[result.id](result);
    }
    // if (this.state.connected === true && this.state.session_connected === true && result.met !== undefined){
    //   return engArray.push(result.met[1]), excArray.push(result.met[3]), strArray.push(result.met[6]), relArray.push(result.met[8]), intArray.push(result.met[10]), focArray.push(result.met[12])
    // }
    // let engMath = engArray.reduce((a, b) => a + b, 0) / engArray.length;
    // let excMath = excArray.reduce((a, b) => a + b, 0) / excArray.length;
    // let strMath = strArray.reduce((a, b) => a + b, 0) / strArray.length;
    // let relMath = relArray.reduce((a, b) => a + b, 0) / relArray.length;
    // let intMath = intArray.reduce((a, b) => a + b, 0) / intArray.length;
    // let focMath = focArray.reduce((a, b) => a + b, 0) / focArray.length;
    // this.setState({eng: engMath, exc: excMath, str: strMath, rel: relMath, int: intMath, foc: focMath})

    // console.log(engMath);
    // console.log(excMath);
    // console.log(strMath);
    // console.log(relMath);
    // console.log(intMath);
    // console.log(focMath);

    if (this.state.connected === true && this.state.session_connected === true){
      if (result.met !== undefined){
        this.handleMetData(result.met);
      }
      if (result.fac !== undefined){
        this.handleFacData(result.fac);
      }

    }
  }

  handleMetData(data){
    //console.log(data);
    //update averages
    let engAvg = (this.state.eng * this.state.numSamples + data[1])/(this.state.numSamples + 1);
    let excAvg = (this.state.exc * this.state.numSamples + data[3])/(this.state.numSamples + 1);
    let strAvg = (this.state.str * this.state.numSamples + data[6])/(this.state.numSamples + 1);
    let relAvg = (this.state.rel * this.state.numSamples + data[8])/(this.state.numSamples + 1);
    let intAvg = (this.state.int * this.state.numSamples + data[10])/(this.state.numSamples + 1);
    let focAvg = (this.state.foc * this.state.numSamples + data[12])/(this.state.numSamples + 1);

    console.log("eng = " + engAvg);
    console.log("exc = " + excAvg);
    console.log("str = " + strAvg);
    console.log("rel = " + relAvg);
    console.log("int = " + intAvg);
    console.log("foc = " + focAvg);

    //if certain average exceeds arbitrary threshold, tell spotify to add current song to playlist, if average goes below low threshold, skip skip, meaning in either case, play next song, then reset all averages and sample count.

    if (excAvg > 0.6){
     this.tellSpotify("addExc") 
    }
    if (engAvg > 0.6){
      this.tellSpotify("addEng")
    }

    if (strAvg > 0.6){
      this.tellSpotify("addStr")
    }

    if (intAvg > 0.6){
      this.tellSpotify("addInt")
    }

    if ( relAvg > 0.6){
      this.tellSpotify("addRel")
    }

    if ( focAvg > 0.6){
      this.tellSpotify("addFoc")
    }
// need to store the current average and number of samples in state for next average calculation 
    this.props.graphCallback(data[1], data[3], data[6], data[8], data[10], data[12]);
    this.setState({eng: engAvg, exc: excAvg, str: strAvg, rel: relAvg, int: intAvg, foc: focAvg, numSamples: this.state.numSamples + 1});
  }


  handleFacData(data){
    let currentEyeAction = data[0];
    if ((currentEyeAction === "winkL" || currentEyeAction === "winkR") && currentEyeAction === this.state.prevEyeAction && currentEyeAction !== this.state.prev2EyeAction){
      console.log("userWinked");
      this.tellSpotify("skip");
    }
    this.setState({prevEyeAction: this.state.currentEyeAction, prev2EyeAction: this.state.prevEyeAction});
  }

  resetAvg() {
    this.setState({eng: 0, exc: 0, str: 0, rel: 0, int: 0, foc: 0, numSamples: 0});
  }

  tellSpotify = (command) => {
      console.log("[Cortex] sending: " + command)
      this.props.parentCallback(command);
  }

  render() {
    return (
            <div>

                <Websocket
            url="wss://localhost:6868"
            onMessage={this.handleData}
            onOpen={this.handleOpen}
            debug={true}
            ref={Websocket => {
                this.refWebSocket = Websocket;
            }}
            />
             {/* this is just for test connecting to api
             <Button onClick={() => this.sendHello()}>Get Info</Button> */}
             <Button onClick={() => this.getUserLogin()}>Connect Headset</Button>
             {/* <Button onClick={() => this.getRequestAccess()}>Request Access</Button>
             <Button onClick={() => this.getAuthentication()}>Authorize</Button>
             <br>
             </br>

             <Button onClick={() => this.queryHeadsets()}>Find Headset</Button>
             <br>
             </br> */}

             {/* <Button onClick={() => this.connectHeadset()}>Connect Headset</Button> */}
             <Button onClick={() => this.disconnectHeadset()}>Disconnect Headset</Button>
            <br>
            </br>
            <Button onClick={() => this.startSession()}>Start Session</Button>
            <Button onClick={() => this.closeSession()}>End Session</Button>
            <Button onClick={() => this.tellSpotify("addExc")}>Tell spotify to add</Button>
            <Button onClick={() => this.tellSpotify("skip")}>Tell spotify to skip</Button>
            <Button onClick={() => this.getDetectionInfo()}>Get trained facial command</Button>
           
            </div>
        )
    };
}
