import React, { useState, useEffect } from 'react';
import { Form, InputNumber, DatePicker, Select, Button, Row, Col, message, notification } from 'antd';
import moment from 'moment';
import axios from 'axios';
import { getFactureService, postFacture } from '../../../services/facturesService';
import { getPatient } from '../../../services/patientService';

const { Option } = Select;

const FactureForm = () => {
  const [form] = Form.useForm();
  const [patient, setPatient] = useState([]);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState({
    Consultation: [],
    Médicament: [],
    Hospitalisation: [],
    Ordonnance: []
  });
  const [serviceDetails, setServiceDetails] = useState([{ service_id: '', service_type: '', montant: 0 }]);
  const [totalMontant, setTotalMontant] = useState(0);

  // Fetch patients and services
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientResponse] = await Promise.all([
          getPatient()
        ]);
        setPatient(patientResponse.data);
        // Fetch services for all types
        for (const type of Object.keys(services)) {
          await fetchServicesByType(type);
        }
      } catch (error) {
        notification.error({
          message: 'Erreur de chargement',
          description: 'Une erreur est survenue lors du chargement des données.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchServicesByType = async (type) => {
    try {
      const response = await getFactureService(type);
      setServices(prev => ({ ...prev, [type]: response.data }));
    } catch (error) {
      message.error('Erreur lors de la récupération des services.');
    }
  };

  const handleServiceTypeChange = (value, index) => {
    fetchServicesByType(value);
    setServiceDetails(prev => {
      const newDetails = [...prev];
      newDetails[index].service_type = value;
      return newDetails;
    });
  };

  const handleServiceChange = (value, index) => {
    const selectedService = services[serviceDetails[index].service_type].find(service => service.id === value);
    setServiceDetails(prev => {
      const newDetails = [...prev];
      newDetails[index] = {
        ...newDetails[index],
        service_id: value,
        montant: selectedService ? selectedService.montant : 0,
      };
      return newDetails;
    });
  };

  const addServiceDetail = () => {
    setServiceDetails(prev => [
      ...prev,
      { service_id: '', service_type: '', montant: 0 },
    ]);
  };

  const removeServiceDetail = (index) => {
    setServiceDetails(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const total = serviceDetails.reduce((total, detail) => total + detail.montant, 0);
    setTotalMontant(total);
    form.setFieldsValue({ montant_total: total });
  }, [serviceDetails]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await postFacture({
        ...values,
        montant_total: totalMontant,
        service_details: serviceDetails,
      });
      message.success('Facture soumise avec succès!');
    } catch (error) {
      message.error('Erreur lors de la soumission de la facture.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        status: 'En attente',
        date_emission: moment(),
        montant_total: totalMontant,
      }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Patient"
            name="patient_id"
            rules={[{ required: true, message: 'Veuillez entrer le patient' }]}
          >
            <Select placeholder="Sélectionnez un patient" style={{ width: '100%' }}>
              {patient.map((p) => (
                <Option key={p.id_patient} value={p.id_patient}>
                  {p.nom_patient}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            label="Date d'émission"
            name="date_emission"
            rules={[{ required: true, message: 'Veuillez sélectionner la date d\'émission' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Date limite"
            name="date_limite"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            label="Montant total"
            name="montant_total"
            rules={[{ required: true, message: 'Veuillez entrer le montant total' }]}
          >
            <InputNumber
              placeholder="Montant total"
              style={{ width: '100%' }}
              min={0}
              precision={2}
              formatter={(value) => `${value} CDF`}
              parser={(value) => value.replace(/ CDF\s?|(,*)/g, '')}
              disabled
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Statut"
            name="status"
            rules={[{ required: true, message: 'Veuillez sélectionner un statut' }]}
          >
            <Select placeholder="Sélectionner le statut" style={{ width: '100%' }}>
              <Option value="En attente">En attente</Option>
              <Option value="Payé">Payé</Option>
              <Option value="En retard">En retard</Option>
              <Option value="Annulé">Annulé</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <h3>Détails des services</h3>
      {serviceDetails.map((detail, index) => (
        <Row gutter={16} key={index}>
          <Col span={10}>
            <Form.Item
              label={`Type de service ${index + 1}`}
              name={['service_details', index, 'service_type']}
              rules={[{ required: true, message: 'Veuillez sélectionner un type de service' }]}
            >
              <Select
                placeholder="Sélectionner le type de service"
                onChange={(value) => handleServiceTypeChange(value, index)}
                style={{ width: '100%' }}
              >
                {Object.keys(services).map(type => (
                  <Option key={type} value={type}>{type}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={10}>
            <Form.Item
              label={`Service ${index + 1}`}
              name={['service_details', index, 'service_id']}
              rules={[{ required: true, message: 'Veuillez sélectionner un service' }]}
            >
              <Select
                placeholder="Sélectionner un service"
                onChange={(value) => handleServiceChange(value, index)}
                style={{ width: '100%' }}
              >
                {services[detail.service_type] && services[detail.service_type].map(service => (
                  <Option key={service.id} value={service.id}>
                    {(() => {
                      switch (detail.service_type) {
                        case 'Consultation':
                          return service.description;
                        case 'Médicament':
                          return service.nom_medicament;
                        case 'Ordonnance':
                          return service.id || 'Nom inconnu';
                        default:
                          return 'Information non disponible';
                      }
                    })()} - {service.montant} CDF
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={4} style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="danger"
              onClick={() => removeServiceDetail(index)}
              icon="minus"
              style={{ width: '100%' }}
            >
              Supprimer
            </Button>
          </Col>
        </Row>
      ))}

      <Button type="dashed" onClick={addServiceDetail} style={{ width: '100%', marginBottom: 16 }}>
        Ajouter un service
      </Button>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Soumettre la facture
        </Button>
      </Form.Item>
    </Form>
  );
};

export default FactureForm;
