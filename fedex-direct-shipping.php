// fedex-direct-shipping.php
if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'woocommerce_shipping_init', 'fedex_direct_init' );
function fedex_direct_init() {
    class WC_Shipping_Fedex_Direct extends WC_Shipping_Method {

        public function __construct( $instance_id = 0 ) {
            $this->id                 = 'fedex_direct';
            $this->instance_id        = absint( $instance_id );
            $this->method_title       = 'FedEx Direto';
            $this->method_description = 'Cálculo via API FedEx (proxy Node).';
            $this->enabled            = 'yes';
            $this->title              = 'FedEx Internacional';
            $this->supports           = array( 'shipping-zones', 'instance-settings' );
            $this->init();
        }

        public function init() {
            $this->init_form_fields();
            $this->init_settings();
            add_action(
              'woocommerce_update_options_shipping_' . $this->id,
              array( $this, 'process_admin_options' )
            );
        }

        public function init_form_fields() {
            $this->form_fields = array(
                'endpoint' => array(
                    'title'       => 'Endpoint do proxy',
                    'type'        => 'text',
                    'default'     => 'https://seu-dominio/rates',
                    'description' => 'URL do serviço Node que chama a FedEx.'
                ),
            );
        }

        public function calculate_shipping( $package = array() ) {
            $dest = $package['destination'];
            $to_country    = $dest['country'];
            $to_postcode   = $dest['postcode'];

            $from_country  = WC()->countries->get_base_country();
            $from_postcode = WC()->countries->get_base_postcode();

            $weight_kg = 0;
            foreach ( $package['contents'] as $item ) {
                if ( $item['data']->has_weight() ) {
                    $weight_kg += wc_get_weight( $item['data']->get_weight(), 'kg' ) * $item['quantity'];
                }
            }
            if ( $weight_kg <= 0 ) $weight_kg = 0.1;

            $endpoint = $this->get_option( 'endpoint' );

            $response = wp_remote_post( $endpoint, array(
                'headers' => array( 'Content-Type' => 'application/json' ),
                'body'    => wp_json_encode( array(
                    'fromPostalCode' => $from_postcode,
                    'fromCountry'    => $from_country,
                    'toPostalCode'   => $to_postcode,
                    'toCountry'      => $to_country,
                    'weightKg'       => $weight_kg,
                ) ),
                'timeout' => 10,
            ) );

            if ( is_wp_error( $response ) ) return;

            $body = json_decode( wp_remote_retrieve_body( $response ), true );
            if ( empty( $body['amount'] ) ) return;

            $cost = floatval( $body['amount'] );

            $rate = array(
                'id'    => $this->id,
                'label' => $this->title,
                'cost'  => $cost,
            );
            $this->add_rate( $rate );
        }
    }
}

add_filter( 'woocommerce_shipping_methods', function( $methods ) {
    $methods['fedex_direct'] = 'WC_Shipping_Fedex_Direct';
    return $methods;
} );
